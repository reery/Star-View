"""Author the reviewed nebula additions of the 2000-ly census.

Rows already in src/data/overlays/nebulae/objects.json that are not listed in
catalog-work/nebulae/additions.json stay byte-for-byte as authored. Listed rows
are regenerated from their reviewed inputs and follow in input order.

Large H II regions take their sky shape from a frozen mask of the Finkbeiner
(2003) all-sky H-alpha composite. Rebuild the masks from the downloaded HEALPix
map with --masks <lambda_halpha_fwhm06_0512.fits>; offline builds read only the
frozen catalog-work/nebulae/halpha-masks.json.

  --check  compare the checked-in overlay without writing it
"""

import argparse
import base64
import hashlib
import json
import math
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "catalog-work/nebulae"
ADDITIONS = WORK / "additions.json"
MASKS = WORK / "halpha-masks.json"
OVERLAY = ROOT / "src/data/overlays/nebulae"
HALPHA_URL = "https://lambda.gsfc.nasa.gov/data/foregrounds/halpha/lambda_halpha_fwhm06_0512.fits"
HALPHA_SHA256 = "0768cb79f20adb0080004e10a8b3671f53a79a8f1d1cf0a2f0faec654c742099"
TYPES = ("reflection_nebula", "hii_region", "planetary_nebula")

# The shared class palettes of the hand-authored census, keyed by what lights the gas.
PALETTES = {
    "hot_star_dust": {"real": ["#d4e2ff", "#93b2ea", "#5f80c2"], "exaggerated": ["#a8e6ff", "#4a95ff", "#3557ff"]},
    "neutral_dust": {"real": ["#e4e6ee", "#b4b9c8", "#7b8194"], "exaggerated": ["#d8e4ff", "#9fb4ff", "#6a7fe0"]},
    "warm_star_dust": {"real": ["#efe2cc", "#c9a77f", "#8a6646"], "exaggerated": ["#ffe3a0", "#ffb35a", "#d9782a"]},
    "ionized_gas": {"real": ["#f2d4da", "#d98898", "#9c3a52"], "exaggerated": ["#ff8fb8", "#ff4f7a", "#d1203c"]},
    "planetary_shell": {"real": ["#d2e6df", "#dc9aa7", "#a8475c"], "exaggerated": ["#5ef0d0", "#ff5fa0", "#ff2a40"]},
}
REFERENCES = {
    "gaia": ("Gaia EDR3", "Gaia Collaboration 2021, A&A 649, A1"),
    "hipparcos": ("Hipparcos new reduction", "van Leeuwen 2007, A&A 474, 653"),
    "cluster-mirages": ("Gaia DR2 cluster", "Cantat-Gaudin & Anders 2020, A&A 633, A99"),
    "cluster-portrait": ("Gaia DR2 cluster", "Cantat-Gaudin et al. 2020, A&A 640, A1"),
}
# IAU ICRS-to-Galactic rotation (Hipparcos convention), identical to src/catalog-model.ts.
ICRS_TO_GALACTIC = (
    (-0.0548755604, -0.8734370902, -0.4838350155),
    (0.4941094279, -0.4448296300, 0.7469822445),
    (-0.8676661490, -0.1980763734, 0.4559837762),
)
# Masks sample the 6-arcmin map at about its native pixel scale.
MASK_PIXEL_ARCMIN = 6.87
MASK_MAX_SIZE = 64
MASK_SUPERSAMPLE = 3
# Fields span 1.25 catalogued diameters; the diffuse background is measured just outside.
BACKGROUND_SCALE = 1.5
# Highlights compress like a stretched long exposure, so faint wings stay visible.
MASK_STRETCH = 0.3


def equatorial_to_galactic(ra, dec, distance):
    alpha, delta = math.radians(ra), math.radians(dec)
    vector = (math.cos(delta) * math.cos(alpha), math.cos(delta) * math.sin(alpha), math.sin(delta))
    return [distance * sum(row[index] * vector[index] for index in range(3)) for row in ICRS_TO_GALACTIC]


def galactic_direction(ra, dec):
    x, y, z = equatorial_to_galactic(ra, dec, 1)
    return math.atan2(y, x) % (2 * math.pi), math.asin(max(-1, min(1, z)))


def constellation(ra, dec):
    from astropy.coordinates import SkyCoord
    import astropy.units as units
    name = SkyCoord(ra=ra * units.deg, dec=dec * units.deg, frame="icrs").get_constellation(short_name=False)
    return {"Boötes": "Bootes", "Chamaleon": "Chamaeleon", "Ophiucus": "Ophiuchus"}.get(name, name)


def adopted_distance(entry):
    distance = entry["distance"]
    if "parallax_mas" in distance:
        parallax, error = distance["parallax_mas"], distance["error_mas"]
        label, citation = REFERENCES[distance["reference"]]
        pc = 1000 / parallax
        return round(pc, 2), round(pc * error / parallax, 2), f"{label} parallax of {distance['star']} ({parallax:g} ± {error:g} mas); {citation}"
    return distance["pc"], distance["error_pc"], distance["source"]


def semi_axis(distance, arcmin):
    return round(distance * math.tan(math.radians(arcmin / 120)), 6)


def ang2pix_nest(nside, theta, phi):
    """HEALPix NESTED pixel indices for colatitude theta and longitude phi in radians."""
    import numpy as np
    z = np.cos(theta)
    za = np.abs(z)
    tt = np.mod(phi, 2 * np.pi) / (np.pi / 2)
    face = np.zeros(z.shape, dtype=np.int64)
    ix = np.zeros(z.shape, dtype=np.int64)
    iy = np.zeros(z.shape, dtype=np.int64)
    equatorial = za <= 2 / 3
    t1 = nside * (0.5 + tt[equatorial])
    t2 = nside * z[equatorial] * 0.75
    jp = (t1 - t2).astype(np.int64)
    jm = (t1 + t2).astype(np.int64)
    ifp, ifm = jp // nside, jm // nside
    face[equatorial] = np.where(ifp == ifm, ifp | 4, np.where(ifp < ifm, ifp, ifm + 8))
    ix[equatorial] = jm & (nside - 1)
    iy[equatorial] = nside - (jp & (nside - 1)) - 1
    polar = ~equatorial
    ntt = np.minimum(3, tt[polar].astype(np.int64))
    tp = tt[polar] - ntt
    tmp = nside * np.sqrt(3 * (1 - za[polar]))
    jp = np.minimum(nside - 1, (tp * tmp).astype(np.int64))
    jm = np.minimum(nside - 1, ((1 - tp) * tmp).astype(np.int64))
    north = z[polar] >= 0
    face[polar] = np.where(north, ntt, ntt + 8)
    ix[polar] = np.where(north, nside - jm - 1, jp)
    iy[polar] = np.where(north, nside - jp - 1, jm)
    interleaved = np.zeros(z.shape, dtype=np.int64)
    for bit in range(int(math.log2(nside))):
        interleaved |= ((ix >> bit) & 1) << (2 * bit)
        interleaved |= ((iy >> bit) & 1) << (2 * bit + 1)
    return face * nside * nside + interleaved


def mask_grid(entry):
    """Tangent-plane pixel centers: rows run toward +b, columns toward +l."""
    import numpy as np
    box = entry["mask"]["box_arcmin"]
    size = min(MASK_MAX_SIZE, max(8, math.ceil(box / MASK_PIXEL_ARCMIN)))
    half = math.tan(math.radians(box / 120))
    steps = (np.arange(size * MASK_SUPERSAMPLE) + 0.5) / (size * MASK_SUPERSAMPLE) * 2 - 1
    east, north = np.meshgrid(steps * half, steps * half)
    longitude, latitude = galactic_direction(entry["ra_deg"], entry["dec_deg"])
    rho = np.hypot(east, north)
    c = np.arctan(rho)
    safe = np.where(rho > 0, rho, 1)
    b = np.arcsin(np.cos(c) * math.sin(latitude) + np.where(rho > 0, north * np.sin(c) * math.cos(latitude) / safe, 0))
    l = longitude + np.arctan2(east * np.sin(c), rho * math.cos(latitude) * np.cos(c) - north * math.sin(latitude) * np.sin(c))
    return size, np.pi / 2 - b, l, (east / half, north / half)


def gnomonic_offset(entry, ra, dec):
    """Tangent-plane offset (toward +l, toward +b) of a direction from the nebula center."""
    center_l, center_b = galactic_direction(entry["ra_deg"], entry["dec_deg"])
    target_l, target_b = galactic_direction(ra, dec)
    delta = target_l - center_l
    cos_c = math.sin(center_b) * math.sin(target_b) + math.cos(center_b) * math.cos(target_b) * math.cos(delta)
    return (math.cos(target_b) * math.sin(delta) / cos_c,
            (math.cos(center_b) * math.sin(target_b) - math.sin(center_b) * math.cos(target_b) * math.cos(delta)) / cos_c)


def build_masks(fits_path):
    import numpy as np
    from astropy.io import fits
    digest = hashlib.sha256(Path(fits_path).read_bytes()).hexdigest()
    if digest != HALPHA_SHA256:
        raise SystemExit(f"Unexpected H-alpha map checksum {digest}")
    with fits.open(fits_path) as hdus:
        header = hdus[1].header
        if header["ORDERING"] != "NESTED" or header["NSIDE"] != 512:
            raise SystemExit("Expected the NESTED Nside 512 Finkbeiner map")
        rayleigh = np.asarray(hdus[1].data["TEMPERATURE"], dtype=np.float64).ravel()
    masks = {}
    for entry in json.loads(ADDITIONS.read_text())["objects"]:
        if "mask" not in entry:
            continue
        size, theta, phi, (u, v) = mask_grid(entry)
        samples = rayleigh[ang2pix_nest(512, theta, phi)]
        samples = samples.reshape(size, MASK_SUPERSAMPLE, size, MASK_SUPERSAMPLE).mean(axis=(1, 3))
        radius = np.hypot(u, v).reshape(size, MASK_SUPERSAMPLE, size, MASK_SUPERSAMPLE).mean(axis=(1, 3))
        # The diffuse warm ionized medium fills the sky; measure it in an annulus outside the field.
        _, ring_theta, ring_phi, (ring_u, ring_v) = mask_grid({**entry, "mask": {"box_arcmin": BACKGROUND_SCALE * entry["mask"]["box_arcmin"]}})
        ring_radius = np.hypot(ring_u, ring_v) * BACKGROUND_SCALE
        background = float(np.median(rayleigh[ang2pix_nest(512, ring_theta, ring_phi)][(ring_radius > 1) & (ring_radius < BACKGROUND_SCALE)]))
        excess = np.clip(samples - background, 0, None)
        # Separately catalogued nebulae inside the box keep their own records.
        half = math.tan(math.radians(entry["mask"]["box_arcmin"] / 120))
        centers = (np.arange(size) + 0.5) / size * 2 - 1
        east, north = np.meshgrid(centers, centers)
        for ra, dec, arcmin in entry["mask"].get("exclude", []):
            x, y = gnomonic_offset(entry, ra, dec)
            excess[np.hypot(east - x / half, north - y / half) < math.tan(math.radians(arcmin / 60)) / half] = 0
        # Taper to the inscribed circle so the box corners never draw.
        excess *= np.clip((1 - radius) / 0.12, 0, 1)
        peak = float(excess.max())
        if peak <= 0:
            raise SystemExit(f"No H-alpha excess for {entry['id']}")
        stretched = np.arcsinh(excess / (MASK_STRETCH * peak)) / math.asinh(1 / MASK_STRETCH)
        values = np.round(stretched * 255).astype(np.uint8)
        masks[entry["id"]] = {
            "size": [size, size],
            "box_arcmin": entry["mask"]["box_arcmin"],
            "background_rayleigh": round(background, 2),
            "peak_excess_rayleigh": round(peak, 2),
            "values": base64.b64encode(values.tobytes()).decode(),
        }
    return {
        "schemaVersion": 1,
        "source": "Finkbeiner (2003), ApJS 146, 407; full-sky H-alpha composite of WHAM, VTSS and SHASSA",
        "url": HALPHA_URL,
        "sha256": HALPHA_SHA256,
        "method": (
            "Gnomonic grid centred on each nebula, rows toward Galactic north and columns toward increasing longitude, "
            f"{MASK_SUPERSAMPLE}x{MASK_SUPERSAMPLE} supersampled; diffuse background is the median between 1 and {BACKGROUND_SCALE} field radii; "
            f"excess is tapered to the inscribed circle and asinh-stretched (softening {MASK_STRETCH} of the peak) to 8 bits."
        ),
        "masks": masks,
    }


def mask_puff_count(mask):
    """One puff per lit pixel; src/nebula-layer.ts weights each by the pixel's brightness."""
    return max(16, min(4096, sum(value > 0 for value in base64.b64decode(mask["values"]))))


def nebula_row(entry, masks):
    distance, error, distance_source = adopted_distance(entry)
    major, minor = entry["angular_size_arcmin"]
    details = {
        "designations": entry["designations"],
        "ra_deg": entry["ra_deg"],
        "dec_deg": entry["dec_deg"],
        "distance_pc": distance,
        "distance_error_pc": error,
        "distance_source": distance_source,
        "position_source": entry["position_source"],
        "angular_size_arcmin": [major, minor],
        "illuminating_stars": entry["illuminating_stars"],
    }
    if "mask" in entry:
        mask = masks["masks"][entry["id"]]
        if mask["box_arcmin"] != entry["mask"]["box_arcmin"]:
            raise SystemExit(f"Stale H-alpha mask for {entry['id']}; rebuild with --masks")
        radius = semi_axis(distance, mask["box_arcmin"])
        depth = round(radius * entry["mask"].get("depth_fraction", 1), 6)
        shape = {"kind": entry["shape"], "semi_axes_pc": [depth, radius, radius], "position_angle_deg": 0,
                 "layer_offsets_pc": [], "mask": {"size": mask["size"], "values": mask["values"]}}
        puff_count = mask_puff_count(mask)
        # Peak surface brightness on the hand-authored 0-1 scale: about 0.45 at 100 R, 0.85 at 10,000 R.
        brightness = round(max(0.25, min(0.9, 0.25 + 0.2 * math.log10(mask["peak_excess_rayleigh"] / 10))), 2)
    else:
        brightness = entry["brightness"]
        # Without a measured orientation, an equal-area circle avoids inventing one.
        radius = semi_axis(distance, math.sqrt(major * minor))
        shape = {"kind": entry["shape"], "semi_axes_pc": [radius, radius, radius], "position_angle_deg": 0, "layer_offsets_pc": []}
        puff_count = max(64, min(1024, round(1.2 * math.sqrt(major * minor))))
    details.update({
        "shape": shape,
        "palette": PALETTES[entry["palette"]],
        "brightness": brightness,
        "puff_count": puff_count,
        "seed": zlib.crc32(entry["id"].encode()) % 9000 + 1000,
        "source_label": entry["source_label"],
        "source_url": entry["source_url"],
        "model_note": entry["model_note"],
    })
    x, y, z = equatorial_to_galactic(entry["ra_deg"], entry["dec_deg"], distance)
    return {
        "type": entry["type"], "id": entry["id"], "name": entry["name"], "spectral_type": None,
        "constellation": constellation(entry["ra_deg"], entry["dec_deg"]),
        "x_pc": round(x, 6), "y_pc": round(y, 6), "z_pc": round(z, 6),
        "vx_kms": None, "vy_kms": None, "vz_kms": None, "temperature_k": None, "mass_solar": None,
        "luminosity_solar": None, "radius_solar": None, "metallicity_dex": None, "age_gyr": None,
        "absolute_mag": None, "epoch": 2000, "notes": entry["notes"], "raw_astrometry": None, "nebula": details,
    }


def dumps(value, indent=0):
    """2-space JSON with scalar arrays kept on one line, matching the hand-authored overlay."""
    pad = "  " * indent
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = [f'{pad}  {json.dumps(key)}: {dumps(item, indent + 1)}' for key, item in value.items()]
        return "{\n" + ",\n".join(items) + f"\n{pad}}}"
    if isinstance(value, list):
        if all(not isinstance(item, (dict, list)) for item in value):
            return "[" + ", ".join(json.dumps(item, ensure_ascii=False) for item in value) + "]"
        return "[\n" + ",\n".join(f"{pad}  {dumps(item, indent + 1)}" for item in value) + f"\n{pad}]"
    return json.dumps(value, ensure_ascii=False)


def render():
    additions = json.loads(ADDITIONS.read_text())["objects"]
    masks = json.loads(MASKS.read_text())
    payload = json.loads((OVERLAY / "objects.json").read_text())
    listed = {entry["id"] for entry in additions}
    objects = [row for row in payload["objects"] if row["id"] not in listed] + [nebula_row(entry, masks) for entry in additions]
    manifest = json.loads((OVERLAY / "manifest.json").read_text())
    manifest["objectCount"] = len(objects)
    manifest["counts"] = {kind: sum(row["type"] == kind for row in objects) for kind in TYPES}
    return {
        "objects.json": dumps({**payload, "objects": objects}) + "\n",
        "manifest.json": json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--masks", metavar="HALPHA_FITS", help="Rebuild the frozen H-alpha masks from the Finkbeiner map")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.masks:
        MASKS.write_text(json.dumps(build_masks(args.masks), indent=2) + "\n")
    outputs = render()
    stale = [name for name, content in outputs.items() if (OVERLAY / name).read_text() != content]
    if args.check:
        if stale:
            sys.exit(f"Nebula overlay is stale: {', '.join(stale)}; run scripts/author-nebulae.py")
        return
    for name in stale:
        (OVERLAY / name).write_text(outputs[name])
    print(f"Wrote {len(json.loads(outputs['objects.json'])['objects'])} nebula rows" if stale else "Nebula overlay is current.")


if __name__ == "__main__":
    main()
