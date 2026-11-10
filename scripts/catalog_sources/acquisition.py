"""Explicit network acquisition for immutable catalog source snapshots."""

import csv
import gzip
import hashlib
import io
import json
import shutil
import ssl
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from .adapters import read_cns5
from .filesystem import atomic_binary_writer, atomic_write_text, managed_path, safe_output_directory, write_managed_files
from .snapshots import canonical_json, sha256, verify_sha256, write_canonical_json

CNS5_README_URL = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe"
CNS5_DATA_URL = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/cns5.dat"
CIFUENTES_README_URL = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/642/A115/ReadMe"
CIFUENTES_DATA_URL = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/642/A115/tablea3.dat.gz"
SIMBAD_TAP_URL = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"
GAIA_TAP_URL = "https://gea.esac.esa.int/tap-server/tap/sync"
VIZIER_TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"
TWOMASS_COLUMNS = ('"2MASS"', "RAJ2000", "DEJ2000", "Jmag", "e_Jmag", "Hmag", "e_Hmag", "Kmag", "e_Kmag", "Qflg", "Bflg", "Cflg", "Date")
TWOMASS_CHUNK = 200
DEFAULT_NETWORK_TIMEOUT_SECONDS = 60.0


def _ssl_context() -> ssl.SSLContext:
    defaults = ssl.get_default_verify_paths()
    if defaults.cafile:
        return ssl.create_default_context()
    system_bundle = Path("/etc/ssl/cert.pem")
    return ssl.create_default_context(cafile=system_bundle if system_bundle.exists() else None)


def _quoted(values: list[str]) -> str:
    return ",".join("'" + value.replace("'", "''") + "'" for value in values)


def simbad_query(cns5_ids: list[str]) -> str:
    identifiers = [f"CNS5 {identifier}" for identifier in cns5_ids]
    return (
        "SELECT ident.id AS query_id, basic.main_id, basic.ra, basic.dec, basic.otype, "
        "basic.sp_type, ids.ids, allfluxes.V FROM ident JOIN basic ON ident.oidref=basic.oid "
        "LEFT OUTER JOIN ids ON basic.oid=ids.oidref LEFT OUTER JOIN allfluxes ON "
        f"basic.oid=allfluxes.oidref WHERE ident.id IN ({_quoted(identifiers)}) ORDER BY query_id"
    )


def gaia_query(gaia_ids: list[str]) -> str:
    if any(not identifier.isdigit() for identifier in gaia_ids):
        raise ValueError("Gaia source identifiers must contain only digits")
    return (
        "SELECT s.source_id,s.ra,s.dec,s.ref_epoch,s.parallax,s.parallax_error,s.pmra," 
        "s.pmra_error,s.pmdec,s.pmdec_error,s.radial_velocity,s.radial_velocity_error," 
        "s.duplicated_source,ap.teff_gspphot,ap.teff_gspphot_lower,ap.teff_gspphot_upper,"
        "ap.mh_gspphot,ap.mh_gspphot_lower,ap.mh_gspphot_upper,"
        "ap.mass_flame,ap.mass_flame_lower,ap.mass_flame_upper,ap.lum_flame,"
        "ap.lum_flame_lower,ap.lum_flame_upper,ap.radius_flame,ap.radius_flame_lower,"
        "ap.radius_flame_upper,ap.age_flame,ap.age_flame_lower,ap.age_flame_upper,"
        "ap.flags_flame FROM "
        "gaiadr3.gaia_source AS s LEFT OUTER JOIN gaiadr3.astrophysical_parameters AS ap "
        f"ON s.source_id=ap.source_id WHERE s.source_id IN ({','.join(gaia_ids)}) ORDER BY s.source_id"
    )


def twomass_query(designations: list[str]) -> str:
    if any(not all(character.isdigit() or character in "+-" for character in designation) or len(designation) != 16 for designation in designations):
        raise ValueError("2MASS designations must be bare 16-character HHMMSSss+DDMMSSs identifiers")
    return f'SELECT {",".join(TWOMASS_COLUMNS)} FROM "II/246/out" WHERE "2MASS" IN ({_quoted(designations)})'


def _download(url: str, output: Path, timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS) -> None:
    with urllib.request.urlopen(url, context=_ssl_context(), timeout=timeout) as response, atomic_binary_writer(output) as target:
        shutil.copyfileobj(response, target)


def _tap_query(url: str, query: str, output: Path, timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS) -> None:
    data = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": query}).encode()
    request = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(request, context=_ssl_context(), timeout=timeout) as response, atomic_binary_writer(output) as target:
        shutil.copyfileobj(response, target)
    if output.read_text(errors="replace").lstrip().startswith("<?xml"):
        raise RuntimeError(f"TAP service returned an error document for {output.name}")


def acquire_nearest1000(
    output: Path,
    retrieved: str,
    buffer_size: int = 1100,
    force: bool = False,
    timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS,
) -> dict:
    if not timeout > 0:
        raise ValueError("Network timeout must be positive")
    output = safe_output_directory(output)
    managed = ("cns5.ReadMe", "cns5.dat", "simbad.csv", "simbad.adql", "gaia.csv", "gaia.adql", "source-manifest.json")
    targets = [managed_path(output, name) for name in managed]
    existing = [path for path in targets if path.exists()]
    if existing and not force:
        raise FileExistsError("Source snapshot exists; use --force only for an intentional refresh")
    with tempfile.TemporaryDirectory(prefix=".catalog-acquire-", dir=output) as staging_name:
        staging = Path(staging_name)
        _download(CNS5_README_URL, staging / "cns5.ReadMe", timeout)
        _download(CNS5_DATA_URL, staging / "cns5.dat", timeout)
        records = [record for record in read_cns5(staging / "cns5.dat") if record.astrometry is not None]
        records.sort(key=lambda record: (-record.astrometry.parallax_mas, record.identity.source_record_id))
        buffer = records[:buffer_size]
        simbad = simbad_query([record.identity.source_record_id for record in buffer])
        gaia_ids = [record.identity.gaia_dr3_id for record in buffer if record.identity.gaia_dr3_id is not None]
        gaia = gaia_query(gaia_ids)
        atomic_write_text(staging / "simbad.adql", simbad + "\n")
        atomic_write_text(staging / "gaia.adql", gaia + "\n")
        _tap_query(SIMBAD_TAP_URL, simbad, staging / "simbad.csv", timeout)
        _tap_query(GAIA_TAP_URL, gaia, staging / "gaia.csv", timeout)
        manifest = {
            "schemaVersion": 1,
            "retrieved": retrieved,
            "bufferSize": buffer_size,
            "sources": {
                "cns5": {"release": "corrected 2023-12-13", "url": CNS5_README_URL},
                "simbad": {"url": SIMBAD_TAP_URL, "queryFile": "simbad.adql"},
                "gaia": {"release": "DR3", "url": GAIA_TAP_URL, "queryFile": "gaia.adql"},
            },
            "checksumsSha256": {name: sha256(staging / name) for name in managed[:-1]},
        }
        write_canonical_json(staging / "source-manifest.json", manifest)
        write_managed_files(output, {name: (staging / name).read_bytes() for name in managed}, True)
    return manifest


def _chunked_tap(url: str, queries: list[str], output: Path, timeout: float) -> int:
    """Run chunked queries into one CSV; every chunk must return the same columns."""
    header = None
    rows = []
    for index, query in enumerate(queries):
        chunk = output.with_name(f"{output.stem}-{index}.csv")
        _tap_query(url, query, chunk, timeout)
        reader = csv.reader(io.StringIO(chunk.read_text()))
        chunk_header = next(reader)
        if header is not None and chunk_header != header:
            raise RuntimeError(f"{output.name} TAP chunks returned different columns")
        header = chunk_header
        rows.extend(reader)
        chunk.unlink()
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    atomic_write_text(output, stream.getvalue())
    return len(rows)


def acquire_nearest5000(
    output: Path,
    retrieved: str,
    root: Path,
    force: bool = False,
    timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS,
) -> dict:
    """Freeze exact-identity sources for every CNS5 record outside the nearest-1000 buffer."""
    from .mdwarf import _unique_alias

    if not timeout > 0:
        raise ValueError("Network timeout must be positive")
    output = safe_output_directory(output)
    managed = ("simbad.adql", "simbad.csv", "gaia.adql", "gaia.csv", "crossmatch.csv", "twomass.adql", "twomass.csv",
               "spectroscopy.adql", "spectroscopy.csv", "fundamental.adql", "fundamental.csv", "sed.adql", "sed.csv", "source-manifest.json")
    if any(managed_path(output, name).exists() for name in managed) and not force:
        raise FileExistsError("Source snapshot exists; use --force only for an intentional refresh")
    frozen = root / "catalog-work/nearest-1000"
    buffer_size = json.loads((frozen / "source-manifest.json").read_text())["bufferSize"]
    records = [record for record in read_cns5(frozen / "cns5.dat") if record.astrometry is not None]
    records.sort(key=lambda record: (-record.astrometry.parallax_mas, record.identity.source_record_id))
    extension = records[buffer_size:]
    chunk = lambda values, size: [values[start:start + size] for start in range(0, len(values), size)]
    with tempfile.TemporaryDirectory(prefix=".catalog-acquire-", dir=output) as staging_name:
        staging = Path(staging_name)
        counts = {}

        def run(name: str, url: str, queries: list[str]) -> None:
            atomic_write_text(staging / f"{name}.adql", "\n".join(queries) + "\n")
            counts[name] = _chunked_tap(url, queries, staging / f"{name}.csv", timeout)

        run("simbad", SIMBAD_TAP_URL, [simbad_query(ids) for ids in chunk([record.identity.source_record_id for record in extension], 500)])
        run("gaia", GAIA_TAP_URL, [gaia_query(ids) for ids in chunk([record.identity.gaia_dr3_id for record in extension if record.identity.gaia_dr3_id], 1000)])
        simbad = list(csv.DictReader(io.StringIO((staging / "simbad.csv").read_text())))
        crossmatch = []
        for row in simbad:
            aliases = tuple(alias.strip() for alias in (row["ids"] or "").split("|"))
            cns5_id = row["query_id"].removeprefix("CNS5 ")
            crossmatch.append({"star_view_id": f"cns5-{int(cns5_id):04d}", "cns5_id": cns5_id, "simbad_id": row["main_id"],
                               "twomass": _unique_alias(aliases, "2MASS J"), "karmn": _unique_alias(aliases, "Karmn "),
                               "gaia_dr2": _unique_alias(aliases, "Gaia DR2 "), "identity_method": "exact SIMBAD CNS5 identity"})
        crossmatch.sort(key=lambda item: item["star_view_id"])
        stream = io.StringIO(newline="")
        writer = csv.DictWriter(stream, fieldnames=list(crossmatch[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(crossmatch)
        atomic_write_text(staging / "crossmatch.csv", stream.getvalue())
        designations = sorted({row["twomass"] for row in crossmatch if row["twomass"]})
        run("twomass", VIZIER_TAP_URL, [twomass_query(values) for values in chunk(designations, TWOMASS_CHUNK)])
        main_ids = sorted({row["main_id"] for row in simbad})
        run("spectroscopy", SIMBAD_TAP_URL, ["SELECT b.main_id,m.teff,m.log_g,m.fe_h,m.bibcode,m.mespos FROM basic AS b JOIN mesFe_h AS m "
                                             f"ON b.oid=m.oidref WHERE b.main_id IN ({_quoted(values)})" for values in chunk(main_ids, 500)])
        hips = sorted({int(alias.removeprefix("HIP ")) for row in simbad for alias in [_unique_alias(tuple((row["ids"] or "").split("|")), "HIP ")] if alias.isdigit()})
        hip_lists = [",".join(map(str, values)) for values in chunk(hips, 1000)]
        run("fundamental", VIZIER_TAP_URL, [f'SELECT HIP,Mass,e_Mass,logRad,e_logRad,logTeff,e_logTeff FROM "J/A+A/352/555/table1" WHERE HIP IN ({values})' for values in hip_lists])
        run("sed", VIZIER_TAP_URL, [f'SELECT HIP,Dist,eDist,Teff,Lum FROM "J/MNRAS/427/343/table2" WHERE HIP IN ({values})' for values in hip_lists])
        manifest = {
            "schemaVersion": 1,
            "retrieved": retrieved,
            "rankedFrom": buffer_size + 1,
            "cns5Records": len(extension),
            "identityPolicy": "Exact CNS5 SIMBAD identifiers; exact Gaia DR3, unique 2MASS, Karmn, Gaia DR2 and HIP aliases; no positional matching",
            "rowCounts": counts,
            "sources": {
                "cns5": {"file": "catalog-work/nearest-1000/cns5.dat", "sha256": sha256(frozen / "cns5.dat")},
                "simbad": {"url": SIMBAD_TAP_URL, "queryFile": "simbad.adql"},
                "gaia": {"release": "DR3", "url": GAIA_TAP_URL, "queryFile": "gaia.adql"},
                "twomass": {"release": "2MASS All-Sky Point Source Catalog, VizieR II/246/out", "url": VIZIER_TAP_URL, "queryFile": "twomass.adql", "reference": "2006AJ....131.1163S"},
                "spectroscopy": {"url": SIMBAD_TAP_URL, "queryFile": "spectroscopy.adql"},
                "fundamental": {"url": VIZIER_TAP_URL, "queryFile": "fundamental.adql"},
                "sed": {"url": VIZIER_TAP_URL, "queryFile": "sed.adql"},
            },
            "checksumsSha256": {name: sha256(staging / name) for name in managed[:-1]},
        }
        write_canonical_json(staging / "source-manifest.json", manifest)
        write_managed_files(output, {name: (staging / name).read_bytes() for name in managed}, True)
    return manifest


NAKED_EYE_LIMIT_V = 6.5


def naked_eye_simbad_query() -> str:
    return (
        "SELECT b.main_id, b.ra, b.dec, b.coo_bibcode, b.otype, b.sp_type, b.sp_bibcode, b.plx_value, b.plx_err, "
        "b.plx_bibcode, b.pmra, b.pmdec, b.pm_err_maj, b.pm_err_min, b.pm_err_angle, b.pm_bibcode, b.rvz_radvel, "
        "b.rvz_err, b.rvz_bibcode, f.flux AS V, f.flux_err AS V_err, f.bibcode AS V_bibcode, i.ids FROM basic AS b "
        "JOIN flux AS f ON b.oid=f.oidref AND f.filter='V' LEFT OUTER JOIN ids AS i ON b.oid=i.oidref "
        f"WHERE f.flux <= {NAKED_EYE_LIMIT_V} ORDER BY main_id"
    )


def acquire_naked_eye_stars(
    output: Path,
    retrieved: str,
    force: bool = False,
    timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS,
    simbad_url: str = SIMBAD_TAP_URL,
) -> dict:
    """Freeze every SIMBAD object with Johnson V <= 6.5 and its exact Gaia DR3 enrichment.

    Hipparcos model tables are added separately by `acquire_hipparcos_models`.
    """
    if not timeout > 0:
        raise ValueError("Network timeout must be positive")
    output = safe_output_directory(output)
    managed = ("simbad.adql", "simbad.csv", "parents.adql", "parents.csv", "gaia.adql", "gaia.csv", "distance.adql", "distance.csv",
               "spectroscopy.adql", "spectroscopy.csv", "source-manifest.json")
    if any(managed_path(output, name).exists() for name in managed) and not force:
        raise FileExistsError("Source snapshot exists; use --force only for an intentional refresh")
    chunk = lambda values, size: [values[start:start + size] for start in range(0, len(values), size)]
    with tempfile.TemporaryDirectory(prefix=".catalog-acquire-", dir=output) as staging_name:
        staging = Path(staging_name)
        counts = {}

        def run(name: str, url: str, queries: list[str]) -> None:
            atomic_write_text(staging / f"{name}.adql", "\n".join(queries) + "\n")
            counts[name] = _chunked_tap(url, queries, staging / f"{name}.csv", timeout)

        run("simbad", simbad_url, [naked_eye_simbad_query()])
        simbad = list(csv.DictReader(io.StringIO((staging / "simbad.csv").read_text())))
        # Close components often carry only V; SIMBAD gives the parallax to their system record.
        unplaced = sorted({row["main_id"] for row in simbad if not row["plx_value"]})
        run("parents", simbad_url, ["SELECT c.main_id AS child_id, p.main_id AS parent_id, p.otype, p.plx_value, p.plx_err, p.plx_bibcode, p.pmra, p.pmdec, "
                                    "p.pm_bibcode, p.rvz_radvel, p.rvz_err, p.rvz_bibcode, i.ids FROM basic AS c JOIN h_link AS h ON h.child=c.oid "
                                    "JOIN basic AS p ON p.oid=h.parent LEFT OUTER JOIN ids AS i ON i.oidref=p.oid "
                                    f"WHERE c.main_id IN ({_quoted(values)}) ORDER BY child_id, parent_id" for values in chunk(unplaced, 500)])
        gaia_ids = sorted({alias.strip().removeprefix("Gaia DR3 ") for row in simbad for alias in (row["ids"] or "").split("|")
                           if alias.strip().startswith("Gaia DR3 ")}, key=int)
        run("gaia", GAIA_TAP_URL, [gaia_query(ids) for ids in chunk(gaia_ids, 1000)])
        run("distance", GAIA_TAP_URL, ["SELECT source_id,r_med_geo,r_lo_geo,r_hi_geo FROM external.gaiaedr3_distance "
                                       f"WHERE source_id IN ({','.join(ids)}) ORDER BY source_id" for ids in chunk(gaia_ids, 1000)])
        main_ids = sorted({row["main_id"] for row in simbad})
        run("spectroscopy", simbad_url, ["SELECT b.main_id,m.teff,m.log_g,m.fe_h,m.bibcode,m.mespos FROM basic AS b JOIN mesFe_h AS m "
                                         f"ON b.oid=m.oidref WHERE b.main_id IN ({_quoted(values)})" for values in chunk(main_ids, 500)])
        manifest = {
            "schemaVersion": 1,
            "retrieved": retrieved,
            "selection": f"Every SIMBAD object with a compiled Johnson V flux <= {NAKED_EYE_LIMIT_V}",
            "identityPolicy": "Exact SIMBAD records; exact Gaia DR3 aliases for Gaia astrometry, astrophysical parameters and Bailer-Jones distances",
            "rowCounts": counts,
            "sources": {
                "simbad": {"url": simbad_url, "queryFile": "simbad.adql"},
                "parents": {"url": simbad_url, "queryFile": "parents.adql", "scope": "SIMBAD hierarchy parents of selected objects without a parallax"},
                "gaia": {"release": "DR3", "url": GAIA_TAP_URL, "queryFile": "gaia.adql"},
                "distance": {"release": "Bailer-Jones et al. 2021 Gaia EDR3 distances", "url": GAIA_TAP_URL, "queryFile": "distance.adql", "reference": "2021AJ....161..147B"},
                "spectroscopy": {"url": simbad_url, "queryFile": "spectroscopy.adql"},
            },
            "checksumsSha256": {name: sha256(staging / name) for name in managed[:-1]},
        }
        write_canonical_json(staging / "source-manifest.json", manifest)
        write_managed_files(output, {name: (staging / name).read_bytes() for name in managed}, True)
    return manifest


GAIA_SUPPLEMENT_INPUTS = ("landmark-stars", "naked-eye-stars", "nearest-1000", "nearest-5000")


def acquire_gaia_supplement(
    output: Path,
    retrieved: str,
    root: Path,
    force: bool = False,
    timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS,
) -> dict:
    """Freeze Gaia DR3 photometry, blending indicators and GSP-Spec parameters for every exact Gaia DR3 source already frozen."""
    if not timeout > 0:
        raise ValueError("Network timeout must be positive")
    output = safe_output_directory(output)
    managed = ("gaia.adql", "gaia.csv", "source-manifest.json")
    if any(managed_path(output, name).exists() for name in managed) and not force:
        raise FileExistsError("Source snapshot exists; use --force only for an intentional refresh")
    inputs = [root / f"catalog-work/{directory}/gaia.csv" for directory in GAIA_SUPPLEMENT_INPUTS]
    ids = sorted({row["source_id"] for path in inputs for row in csv.DictReader(io.StringIO(path.read_text()))}, key=int)
    if any(not identifier.isdigit() for identifier in ids):
        raise ValueError("Gaia source identifiers must contain only digits")
    queries = [
        "SELECT s.source_id,s.phot_g_mean_mag,s.phot_bp_mean_mag,s.phot_rp_mean_mag,s.bp_rp,s.phot_bp_rp_excess_factor,"
        "s.ruwe,s.ipd_frac_multi_peak,s.duplicated_source,ap.teff_gspspec,ap.logg_gspspec,ap.mh_gspspec,ap.mh_gspspec_lower,"
        "ap.mh_gspspec_upper,ap.flags_gspspec FROM gaiadr3.gaia_source AS s LEFT OUTER JOIN gaiadr3.astrophysical_parameters AS ap "
        f"ON s.source_id=ap.source_id WHERE s.source_id IN ({','.join(ids[start:start + 1000])}) ORDER BY s.source_id"
        for start in range(0, len(ids), 1000)]
    with tempfile.TemporaryDirectory(prefix=".catalog-acquire-", dir=output) as staging_name:
        staging = Path(staging_name)
        atomic_write_text(staging / "gaia.adql", "\n".join(queries) + "\n")
        rows = _chunked_tap(GAIA_TAP_URL, queries, staging / "gaia.csv", timeout)
        manifest = {
            "schemaVersion": 1,
            "retrieved": retrieved,
            "identityPolicy": "Exact Gaia DR3 source identifiers already frozen in the listed catalog snapshots; no positional matching",
            "inputChecksumsSha256": {str(path.relative_to(root)): sha256(path) for path in inputs},
            "rowCounts": {"gaia": rows},
            "sources": {"gaia": {"release": "DR3", "url": GAIA_TAP_URL, "queryFile": "gaia.adql"}},
            "checksumsSha256": {name: sha256(staging / name) for name in managed[:-1]},
        }
        write_canonical_json(staging / "source-manifest.json", manifest)
        write_managed_files(output, {name: (staging / name).read_bytes() for name in managed}, True)
    return manifest


VIZIER_URL = "https://vizier.cds.unistra.fr"
# Table, columns, reference, and the identity column that selects rows: HIP or SIMBAD name.
# Hunt & Reffert 2023 cluster ages were evaluated and left out: only 21 of 189 qualifying members had ages within 0.2 dex.
VIZIER_SUPPLEMENT = {
    "casagrande2011": ("J/A+A/530/A138/catalog", ("HIP", "m_Name", "ageMB", "age16B", "age84B"), "2011A&A...530A.138C", "hip"),
    "david2015": ("J/ApJ/804/146/table5", ("HIP", "Agemed", "Age68lo", "Age68up", "Age68t"), "2015ApJ...804..146D", "hip"),
    "jmdc": ("II/345/jmdc", ("ID1", "LDdiam", "e_LDdiam", "Band", "Method", "BibCode", "Notes"), "2016yCat.2345....0D", "name"),
}


def acquire_vizier_supplement(
    output: Path,
    retrieved: str,
    root: Path,
    force: bool = False,
    timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS,
    vizier_url: str = VIZIER_URL,
) -> dict:
    """Freeze age and measured-diameter catalogs for every exact identity already frozen in the catalog snapshots."""
    if not timeout > 0:
        raise ValueError("Network timeout must be positive")
    output = safe_output_directory(output)
    managed = tuple(f"{name}.csv" for name in VIZIER_SUPPLEMENT) + ("source-manifest.json",)
    if any(managed_path(output, name).exists() for name in managed) and not force:
        raise FileExistsError("Source snapshot exists; use --force only for an intentional refresh")
    simbad_inputs = sorted(path for path in (root / "catalog-work").glob("*/simbad.csv") if "ids" in path.open().readline().strip().split(","))
    hips, names = set(), set()
    for path in simbad_inputs:
        for row in csv.DictReader(io.StringIO(path.read_text())):
            aliases = {" ".join(alias.split()) for alias in [row["main_id"], *(row["ids"] or "").split("|")] if alias.strip()}
            # JMDC writes names without spaces (HD206778); compare space-free identifiers.
            names |= {"".join(alias.removeprefix("* ").split()) for alias in aliases}
            hip = {alias.removeprefix("HIP ") for alias in aliases if alias.startswith("HIP ")}
            hips |= hip if len(hip) == 1 else set()
    files, counts, sources = {}, {}, {}
    with tempfile.TemporaryDirectory(prefix=".catalog-acquire-", dir=output) as staging_name:
        for name, (table, columns, reference, identity) in VIZIER_SUPPLEMENT.items():
            url, rows = _vizier_table(vizier_url, table, columns, Path(staging_name) / f"{name}.tsv", timeout)
            keep = {"hip": hips, "name": names}[identity]
            selected = sorted(row for row in rows if ("".join(row[0].split()) if identity == "name" else row[0]) in keep)
            files[f"{name}.csv"] = _csv_text(columns, selected)
            counts[name] = len(selected)
            sources[name] = {"url": url, "release": f"VizieR {table}", "reference": reference, "tableRows": len(rows),
                             "selection": {"hip": "Unique SIMBAD HIP aliases", "name": "Exact SIMBAD identifiers, compared without spaces"}[identity]}
    manifest = {
        "schemaVersion": 1,
        "retrieved": retrieved,
        "identityPolicy": "Exact HIP and SIMBAD identifiers already frozen in the catalog snapshots; no positional matching",
        "inputChecksumsSha256": {str(path.relative_to(root)): sha256(path) for path in simbad_inputs},
        "rowCounts": counts,
        "sources": sources,
        "checksumsSha256": {name: hashlib.sha256(text.encode()).hexdigest() for name, text in files.items()},
    }
    write_managed_files(output, {**files, "source-manifest.json": canonical_json(manifest)}, True)
    return manifest
HIPPARCOS_MODELS = {
    "fundamental": ("J/A+A/352/555/table1", ("HIP", "Mass", "e_Mass", "logRad", "e_logRad", "logTeff", "e_logTeff"), "1999A&A...352..555A"),
    "sed": ("J/MNRAS/427/343/table2", ("HIP", "Dist", "eDist", "Teff", "Lum"), "2012MNRAS.427..343M"),
}


def _vizier_table(vizier_url: str, table: str, columns: tuple[str, ...], output: Path, timeout: float) -> tuple[str, list[list[str]]]:
    """A complete VizieR table through ASU-TSV, which official mirrors also serve."""
    url = f"{vizier_url}/viz-bin/asu-tsv?" + urllib.parse.urlencode({"-source": table, "-out": ",".join(columns), "-out.max": "unlimited"}, safe="/,")
    _download(url, output, timeout)
    # ASU-TSV: comment lines, then column names, units (possibly blank) and a dash rule before the data.
    lines = [line for line in output.read_text().splitlines() if not line.startswith("#")]
    start = next((index for index, line in enumerate(lines) if line.strip()), None)
    if start is None:
        raise RuntimeError(f"VizieR returned no table for {table}; some mirror nodes answer empty, so retry or use another mirror")
    if lines[start].split("\t") != list(columns) or len(lines) < start + 3 or set(lines[start + 2]) - {"-", "\t"}:
        raise RuntimeError(f"VizieR returned unexpected columns for {table}")
    rows = [[value.strip() for value in line.split("\t")] for line in lines[start + 3:] if line.strip()]
    if any(len(row) != len(columns) for row in rows):
        raise RuntimeError(f"VizieR returned malformed rows for {table}")
    return url, rows


def _csv_text(columns, rows) -> str:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(columns)
    writer.writerows(rows)
    return stream.getvalue()


def acquire_hipparcos_models(
    output: Path,
    retrieved: str,
    force: bool = False,
    timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS,
    vizier_url: str = VIZIER_URL,
) -> dict:
    """Add exact-HIP Allende Prieto & Lambert 1999 and McDonald et al. 2012 rows to a frozen SIMBAD snapshot.

    Complete tables come through VizieR's ASU interface, which official mirrors
    also serve, and are filtered locally to each object's unique SIMBAD HIP alias.
    """
    if not timeout > 0:
        raise ValueError("Network timeout must be positive")
    output = safe_output_directory(output)
    manifest = json.loads(managed_path(output, "source-manifest.json").read_text())
    if any(name in manifest["sources"] for name in HIPPARCOS_MODELS) and not force:
        raise FileExistsError("Hipparcos model snapshot exists; use --force only for an intentional refresh")
    for name, digest in manifest["checksumsSha256"].items():
        verify_sha256(managed_path(output, name), digest)
    hips = set()
    for row in csv.DictReader(io.StringIO(managed_path(output, "simbad.csv").read_text())):
        values = {" ".join(alias.split()).removeprefix("HIP ") for alias in (row["ids"] or "").split("|") if " ".join(alias.split()).startswith("HIP ")}
        hips |= values if len(values) == 1 else set()
    files = {}
    with tempfile.TemporaryDirectory(prefix=".catalog-acquire-", dir=output) as staging_name:
        for name, (table, columns, reference) in HIPPARCOS_MODELS.items():
            url, rows = _vizier_table(vizier_url, table, columns, Path(staging_name) / f"{name}.tsv", timeout)
            selected = sorted((row for row in rows if row[0] in hips), key=lambda row: int(row[0]))
            files[f"{name}.csv"] = _csv_text(columns, selected)
            manifest["rowCounts"][name] = len(selected)
            manifest["sources"][name] = {"url": url, "release": f"VizieR {table}", "reference": reference, "retrieved": retrieved, "tableRows": len(rows),
                                         "selection": "Rows whose HIP equals the unique SIMBAD HIP alias of a snapshot object"}
    for name, text in files.items():
        manifest["checksumsSha256"][name] = hashlib.sha256(text.encode()).hexdigest()
    write_managed_files(output, {**files, "source-manifest.json": canonical_json(manifest)}, True)
    return manifest


def acquire_physical_supplements(
    output: Path,
    retrieved: str,
    root: Path,
    force: bool = False,
    timeout: float = DEFAULT_NETWORK_TIMEOUT_SECONDS,
) -> dict:
    from .mdwarf import build_crossmatch

    if not timeout > 0:
        raise ValueError("Network timeout must be positive")
    output = safe_output_directory(output)
    managed = ("cifuentes2020.ReadMe", "cifuentes2020-tablea3.dat", "crossmatch.csv", "twomass.adql", "twomass.csv", "source-manifest.json")
    targets = [managed_path(output, name) for name in managed]
    if any(path.exists() for path in targets) and not force:
        raise FileExistsError("Source snapshot exists; use --force only for an intentional refresh")
    with tempfile.TemporaryDirectory(prefix=".catalog-acquire-", dir=output) as staging_name:
        staging = Path(staging_name)
        _download(CIFUENTES_README_URL, staging / "cifuentes2020.ReadMe", timeout)
        _download(CIFUENTES_DATA_URL, staging / "tablea3.dat.gz", timeout)
        compressed_sha256 = sha256(staging / "tablea3.dat.gz")
        atomic_write_text(staging / "cifuentes2020-tablea3.dat", gzip.decompress((staging / "tablea3.dat.gz").read_bytes()).decode("ascii"))
        crossmatch = build_crossmatch(root)
        atomic_write_text(staging / "crossmatch.csv", crossmatch)
        designations = sorted({row["twomass"] for row in csv.DictReader(io.StringIO(crossmatch)) if row["twomass"]})
        queries = [twomass_query(designations[start:start + TWOMASS_CHUNK]) for start in range(0, len(designations), TWOMASS_CHUNK)]
        atomic_write_text(staging / "twomass.adql", "\n".join(queries) + "\n")
        header = None
        rows = []
        for index, query in enumerate(queries):
            chunk = staging / f"twomass-{index}.csv"
            _tap_query(VIZIER_TAP_URL, query, chunk, timeout)
            reader = csv.reader(io.StringIO(chunk.read_text()))
            chunk_header = next(reader)
            if header is not None and chunk_header != header:
                raise RuntimeError("2MASS TAP chunks returned different columns")
            header = chunk_header
            rows.extend(reader)
        designation_column = header.index("2MASS")
        rows.sort(key=lambda row: row[designation_column].strip())
        stream = io.StringIO(newline="")
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)
        atomic_write_text(staging / "twomass.csv", stream.getvalue())
        manifest = {
            "schemaVersion": 1,
            "retrieved": retrieved,
            "sources": {
                "cifuentes2020": {"release": "J/A+A/642/A115, CDS 20-Jul-2020", "url": CIFUENTES_README_URL, "compressedDataSha256": compressed_sha256, "reference": "2020A&A...642A.115C"},
                "twomass": {"release": "2MASS All-Sky Point Source Catalog, VizieR II/246/out", "url": VIZIER_TAP_URL, "queryFile": "twomass.adql", "reference": "2006AJ....131.1163S", "designations": len(designations), "rows": len(rows)},
                "crossmatch": {"method": "Exact identifiers from frozen nearest-1000 SIMBAD export and nearest-100 10pc identities; no positional matching", "rows": crossmatch.count("\n") - 1},
            },
            "checksumsSha256": {name: sha256(staging / name) for name in managed[:-1]},
        }
        write_canonical_json(staging / "source-manifest.json", manifest)
        write_managed_files(output, {name: (staging / name).read_bytes() for name in managed}, True)
    return manifest
