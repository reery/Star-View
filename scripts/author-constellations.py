"""Author reviewed constellation charts from the existing offline source chain."""

import argparse
import csv
import gzip
import hashlib
import json
import math
import re
from collections import defaultdict
from functools import cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "catalog-work/western-constellation-stars"
CATALOG = ROOT / "src/data/catalogs/western-constellation-stars/stars.csv"
OUTPUT = ROOT / "src/data/constellations"
BOUNDARIES = ROOT / "catalog-work/constellation-charts"
# Add a constellation here after reviewing its figure and labels in the card.
REVIEWED = {"CMa": ("Canis Major", "canis-major"), "Cen": ("Centaurus", "centaurus")}
GREEK = dict(zip(
    ("alf", "bet", "gam", "del", "eps", "zet", "eta", "tet", "iot", "kap", "lam", "mu.",
     "nu.", "ksi", "omi", "pi.", "rho", "sig", "tau", "ups", "phi", "chi", "psi", "ome"),
    "αβγδεζηθικλμνξοπρστυφχψω",
))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def catalog_object(row):
    physical = ("x_pc", "y_pc", "z_pc", "vx_kms", "vy_kms", "vz_kms", "temperature_k",
                "mass_solar", "luminosity_solar", "radius_solar", "metallicity_dex", "age_gyr", "absolute_mag", "epoch")
    result = {key: float(row[key]) if row[key] else None for key in physical}
    result.update({key: row.get(key) or None for key in ("type", "id", "name", "constellation", "spectral_type", "metallicity_kind", "notes")})
    result["designations"] = json.loads(row["designations"]) if row.get("designations") else []
    raw = ("ra_deg", "dec_deg", "parallax_mas", "parallax_error_mas", "pm_ra_cosdec_masyr",
           "pm_ra_error_masyr", "pm_dec_masyr", "pm_dec_error_masyr", "radial_velocity_kms", "radial_velocity_error_kms")
    result["raw_astrometry"] = {key: float(row[key]) if row[key] else None for key in raw}
    result["raw_astrometry"].update(epoch=float(row["astrometry_epoch"]), astrometry_ref=row["astrometry_ref"], radial_velocity_ref=row["radial_velocity_ref"] or None)
    return result


def boundary_order_position(ra_deg, dec_deg):
    """Undo the source's J2000 precession only to identify B1875 contour edges.

    Drawn coordinates always remain the original, sampled J2000 values.
    """
    t = -1.25
    zeta = math.radians((2306.2181 * t + 0.30188 * t ** 2 + 0.017998 * t ** 3) / 3600)
    z = math.radians((2306.2181 * t + 1.09468 * t ** 2 + 0.018203 * t ** 3) / 3600)
    theta = math.radians((2004.3109 * t - 0.42665 * t ** 2 - 0.041833 * t ** 3) / 3600)
    ra, dec = math.radians(ra_deg), math.radians(dec_deg)
    a = math.cos(dec) * math.sin(ra + zeta)
    b = math.cos(theta) * math.cos(dec) * math.cos(ra + zeta) - math.sin(theta) * math.sin(dec)
    c = math.sin(theta) * math.cos(dec) * math.cos(ra + zeta) + math.cos(theta) * math.sin(dec)
    return math.degrees(math.atan2(a, b) + z) % 360, math.degrees(math.asin(c))


@cache
def boundary_inputs():
    manifest = json.loads((BOUNDARIES / "source-manifest.json").read_text())
    for source in manifest["sources"].values():
        if sha256(BOUNDARIES / source["file"]) != source["sha256"]:
            raise ValueError(f"Frozen boundary checksum mismatch: {source['file']}")
    rows = gzip.decompress((BOUNDARIES / "boundaries-j2000.dat.gz").read_bytes()).decode().splitlines()
    vertices = defaultdict(dict)
    for row in rows:
        point = (float(row[:11]), float(row[12:23]))
        name = row[24:28].strip()
        # Some CDS endpoints occur as both original and interpolated samples.
        original = row[29] == "O" or vertices[name].get(point, {}).get("original", False)
        vertices[name][point] = {"ra_deg": point[0], "dec_deg": point[1], "original": original,
                                 "order": boundary_order_position(*point)}
    contours = defaultdict(list)
    for row in (BOUNDARIES / manifest["sources"]["contours"]["file"]).read_text().splitlines():
        contours[row[19:23].strip().upper()].append((float(row[:8]) * 15, float(row[9:18]), row[24:28].strip().upper()))
    return {name: list(points.values()) for name, points in vertices.items()}, contours, manifest


def chart_boundaries(abbreviation, center, culture):
    vertices_by_name, contours, manifest = boundary_inputs()
    vertices = vertices_by_name[abbreviation.upper()]
    contour = contours[abbreviation.upper()]
    if not contour or contour[0][:2] != contour[-1][:2]:
        raise ValueError(f"Missing closed boundary contour: {abbreviation}")
    names = {c["iau"].upper(): c["common_name"]["native"] for c in culture["constellations"]}
    result = []
    used = set()
    tolerance = 0.001  # Degrees; much smaller than the source's 1-degree sampling.
    for a, b in zip(contour, contour[1:]):
        delta_ra = (b[0] - a[0] + 180) % 360 - 180
        delta_dec = b[1] - a[1]
        if (abs(delta_ra) < tolerance) == (abs(delta_dec) < tolerance):
            raise ValueError(f"Boundary is not a B1875 meridian or parallel: {a}, {b}")
        samples = []
        for index, vertex in enumerate(vertices):
            ra, dec = vertex["order"]
            relative_ra = (ra - a[0] + 180) % 360 - 180
            if abs(delta_ra) < tolerance:
                along, across = (dec - a[1]) / delta_dec, abs(relative_ra)
            else:
                along, across = relative_ra / delta_ra, abs(dec - a[1])
            if across < tolerance and -tolerance <= along <= 1 + tolerance:
                samples.append((along, vertex))
                used.add(index)
        samples.sort(key=lambda sample: sample[0])
        segment = [vertex for _, vertex in samples]
        if len(segment) < 2 or not segment[0]["original"] or not segment[-1]["original"]:
            raise ValueError(f"Missing sampled boundary endpoints: {abbreviation}, {a}, {b}")
        neighbor = b[2]
        result.append({"neighbor": names[neighbor], "neighbor_abbreviation": neighbor,
                       "points": [{"ra_deg": p["ra_deg"], "dec_deg": p["dec_deg"]} for p in reversed(segment)]})
    if len(used) != len(vertices):
        raise ValueError(f"Unmatched boundary samples: {abbreviation}, {len(vertices) - len(used)}")
    # Stable winding and starting edge preserve the first chart's authored layout.
    result.reverse()
    start = min(range(len(result)), key=lambda i: math.atan2(result[i]["points"][0]["dec_deg"] - center["dec_deg"],
        ((result[i]["points"][0]["ra_deg"] - center["ra_deg"] + 180) % 360 - 180) * math.cos(math.radians(center["dec_deg"]))))
    result = result[start:] + result[:start]
    if any(a["points"][-1] != b["points"][0] for a, b in zip(result, result[1:] + result[:1])):
        raise ValueError(f"Disconnected sampled boundary: {abbreviation}")
    return result, manifest


@cache
def figure_inputs():
    manifest = json.loads((SOURCE / "source-manifest.json").read_text())
    for source in manifest["sources"].values():
        filename = source.get("file", source.get("resultFile"))
        if filename and sha256(SOURCE / filename) != source["sha256"]:
            raise ValueError(f"Frozen source checksum mismatch: {filename}")
    culture = json.loads((SOURCE / "stellarium-western-index.json").read_text())
    with CATALOG.open(newline="") as handle:
        catalog = {row["id"]: row for row in csv.DictReader(handle)}
    with (SOURCE / "hipparcos-v.csv").open(newline="") as handle:
        magnitudes = {int(row["hip"]): float(row["johnson_v"]) for row in csv.DictReader(handle)}
    with (SOURCE / "simbad.csv").open(newline="") as handle:
        identities = {int(match.group(1)): row for row in csv.DictReader(handle)
                      if (match := re.search(r"(?:^|\|)HIP\s+(\d+)(?:\||$)", row["ids"]))}
    return manifest, culture, catalog, magnitudes, identities, sha256(CATALOG)


def author(abbreviation):
    manifest, culture, catalog, magnitudes, identities, catalog_checksum = figure_inputs()
    figure = next(c for c in culture["constellations"] if c.get("iau") == abbreviation)
    # Stellarium can put a style token (e.g. 'thin') before a star polyline.
    polylines = [[hip for hip in line if isinstance(hip, int)] for line in figure["lines"]]
    identifiers = sorted({hip for line in polylines for hip in line})
    stars = []
    for hip in identifiers:
        row = catalog[f"hip-{hip}"]
        designation = re.match(r"\*\s+([a-z.]+)(\d+)?\s+" + abbreviation + r"(?:\s+[A-Z])?$", identities[hip]["main_id"])
        bayer = (GREEK.get(designation[1], "") + (str(int(designation[2])) if designation[2] else "")) if designation else None
        physical = catalog_object(row)
        physical["designations"] = sorted(set(physical["designations"] + [f"HIP {hip}"]))
        stars.append({
            "hip": hip, "name": row["name"],
            "ra_deg": float(row["ra_deg"]), "dec_deg": float(row["dec_deg"]),
            "magnitude_v": magnitudes[hip],
            "bayer": bayer, "object": physical,
        })
    # A spherical mean also works for figures crossing RA=0.
    vectors = [(math.cos(math.radians(s["dec_deg"])) * math.cos(math.radians(s["ra_deg"])),
                math.cos(math.radians(s["dec_deg"])) * math.sin(math.radians(s["ra_deg"])),
                math.sin(math.radians(s["dec_deg"]))) for s in stars]
    x, y, z = (sum(v[i] for v in vectors) for i in range(3))
    name, slug = REVIEWED[abbreviation]
    center = {"ra_deg": math.degrees(math.atan2(y, x)) % 360,
              "dec_deg": math.degrees(math.atan2(z, math.hypot(x, y)))}
    boundaries, boundary_source = chart_boundaries(abbreviation, center, culture)
    data = {
        "schemaVersion": 1, "abbreviation": abbreviation, "name": name,
        "center": center,
        "stars": stars,
        "lines": [[a, b] for line in polylines for a, b in zip(line, line[1:])],
        "boundaries": boundaries,
        "sources": [
            {"label": "Stellarium Western sky culture", "url": manifest["sources"]["stellarium"]["url"],
             "path": "catalog-work/western-constellation-stars/stellarium-western-index.json",
             "sha256": manifest["sources"]["stellarium"]["sha256"]},
            {"label": "Adopted star positions and names", "url": "https://simbad.cds.unistra.fr/simbad/",
             "path": str(CATALOG.relative_to(ROOT)), "sha256": catalog_checksum},
            {"label": "Hipparcos Johnson V magnitudes", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239",
             "path": "catalog-work/western-constellation-stars/hipparcos-v.csv",
             "sha256": manifest["sources"]["hipparcos"]["sha256"]},
            {"label": "CDS / IAU constellation boundaries (J2000)", "url": "https://cdsarc.cds.unistra.fr/viz-bin/cat/VI/49",
             "path": "catalog-work/constellation-charts/boundaries-j2000.dat.gz", "sha256": boundary_source["sources"]["boundaries"]["sha256"],
             "inputs": [{"path": str((BOUNDARIES / boundary_source["sources"][key]["file"]).relative_to(ROOT)),
                         "sha256": boundary_source["sources"][key]["sha256"]}
                        for key in ("contours", "contourDocumentation")]},
        ],
    }
    return OUTPUT / f"{slug}.json", json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Write reviewed chart data")
    args = parser.parse_args()
    for abbreviation in REVIEWED:
        path, content = author(abbreviation)
        if args.write:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        elif not path.exists() or path.read_text() != content:
            raise SystemExit(f"Chart differs: {path.relative_to(ROOT)}; regenerate with --write")
        print(f"{abbreviation}: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
