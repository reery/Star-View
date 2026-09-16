"""Explicit network acquisition for immutable catalog source snapshots."""

import shutil
import ssl
import urllib.parse
import urllib.request
from pathlib import Path

from .adapters import read_cns5
from .snapshots import sha256, write_canonical_json

CNS5_README_URL = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/ReadMe"
CNS5_DATA_URL = "https://cdsarc.cds.unistra.fr/ftp/J/A+A/670/A19/cns5.dat"
SIMBAD_TAP_URL = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"
GAIA_TAP_URL = "https://gea.esac.esa.int/tap-server/tap/sync"


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
        "ap.mass_flame,ap.mass_flame_lower,ap.mass_flame_upper,ap.lum_flame,"
        "ap.lum_flame_lower,ap.lum_flame_upper,ap.flags_flame FROM "
        "gaiadr3.gaia_source AS s LEFT OUTER JOIN gaiadr3.astrophysical_parameters AS ap "
        f"ON s.source_id=ap.source_id WHERE s.source_id IN ({','.join(gaia_ids)}) ORDER BY s.source_id"
    )


def _download(url: str, output: Path) -> None:
    with urllib.request.urlopen(url, context=_ssl_context()) as response, output.open("wb") as target:
        shutil.copyfileobj(response, target)


def _tap_query(url: str, query: str, output: Path) -> None:
    data = urllib.parse.urlencode({"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": query}).encode()
    request = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(request, context=_ssl_context()) as response, output.open("wb") as target:
        shutil.copyfileobj(response, target)
    if output.read_text(errors="replace").lstrip().startswith("<?xml"):
        raise RuntimeError(f"TAP service returned an error document for {output.name}")


def acquire_nearest1000(output: Path, retrieved: str, buffer_size: int = 1100, force: bool = False) -> dict:
    managed = ("cns5.ReadMe", "cns5.dat", "simbad.csv", "simbad.adql", "gaia.csv", "gaia.adql", "source-manifest.json")
    existing = [output / name for name in managed if (output / name).exists()]
    if existing and not force:
        raise FileExistsError("Source snapshot exists; use --force only for an intentional refresh")
    output.mkdir(parents=True, exist_ok=True)
    _download(CNS5_README_URL, output / "cns5.ReadMe")
    _download(CNS5_DATA_URL, output / "cns5.dat")
    records = [record for record in read_cns5(output / "cns5.dat") if record.astrometry is not None]
    records.sort(key=lambda record: (-record.astrometry.parallax_mas, record.identity.source_record_id))
    buffer = records[:buffer_size]
    simbad = simbad_query([record.identity.source_record_id for record in buffer])
    gaia_ids = [record.identity.gaia_dr3_id for record in buffer if record.identity.gaia_dr3_id is not None]
    gaia = gaia_query(gaia_ids)
    (output / "simbad.adql").write_text(simbad + "\n")
    (output / "gaia.adql").write_text(gaia + "\n")
    _tap_query(SIMBAD_TAP_URL, simbad, output / "simbad.csv")
    _tap_query(GAIA_TAP_URL, gaia, output / "gaia.csv")
    manifest = {
        "schemaVersion": 1,
        "retrieved": retrieved,
        "bufferSize": buffer_size,
        "sources": {
            "cns5": {"release": "corrected 2023-12-13", "url": CNS5_README_URL},
            "simbad": {"url": SIMBAD_TAP_URL, "queryFile": "simbad.adql"},
            "gaia": {"release": "DR3", "url": GAIA_TAP_URL, "queryFile": "gaia.adql"},
        },
        "checksumsSha256": {name: sha256(output / name) for name in managed[:-1]},
    }
    write_canonical_json(output / "source-manifest.json", manifest)
    return manifest