"""Explicit network acquisition for immutable catalog source snapshots."""

import csv
import gzip
import io
import shutil
import ssl
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from .adapters import read_cns5
from .filesystem import atomic_binary_writer, atomic_write_text, managed_path, safe_output_directory, write_managed_files
from .snapshots import sha256, write_canonical_json

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
