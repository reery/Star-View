"""Author the reviewed nebula additions of the 2000-ly census.

Rows already in src/data/overlays/nebulae/objects.json that are not listed in
catalog-work/nebulae/additions.json keep their authored values. Listed rows are
regenerated from their reviewed inputs and follow in input order.

Large H II regions take their sky shape from a frozen mask of the Finkbeiner
(2003) all-sky H-alpha composite. Rebuild the masks from the downloaded HEALPix
map with --masks <lambda_halpha_fwhm06_0512.fits>; offline builds read only the
frozen catalog-work/nebulae/halpha-masks.json.

The Crab Nebula takes its 3D filaments from the published SITELLE reconstruction
of Martin, Milisavljevic & Drissen (2021). Rebuild the frozen point set with
--points <directory holding 3dmap_XYZflux.fits and 3dmap_XYZvel.fits>; offline
builds read only catalog-work/nebulae/point-clouds.json.

Every row, including those kept as authored, takes its surface brightness from
catalog-work/nebulae/surface-brightness.json. Rebuild it with
--surface-brightness <directory> holding the Finkbeiner map above and these
VizieR tables as tab-separated files (asu-tsv, -out.all, -out.max=unlimited):
VII_9.tsv (Lynds 1965), VII_21.tsv (van den Bergh 1966), VII_218.tsv
(van den Bergh & Herbst 1975), V_84_main.tsv, V_84_diam.tsv and V_84_hbeta.tsv
(Acker et al. 1992).

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
POINTS = WORK / "point-clouds.json"
SURFACE_BRIGHTNESS = WORK / "surface-brightness.json"
OVERLAY = ROOT / "src/data/overlays/nebulae"
HALPHA_URL = "https://lambda.gsfc.nasa.gov/data/foregrounds/halpha/lambda_halpha_fwhm06_0512.fits"
HALPHA_SHA256 = "0768cb79f20adb0080004e10a8b3671f53a79a8f1d1cf0a2f0faec654c742099"
TYPES = ("reflection_nebula", "hii_region", "planetary_nebula", "supernova_remnant")

# The shared class palettes of the hand-authored census, keyed by what lights the gas.
PALETTES = {
    "hot_star_dust": {"real": ["#d4e2ff", "#93b2ea", "#5f80c2"], "exaggerated": ["#a8e6ff", "#4a95ff", "#3557ff"]},
    "neutral_dust": {"real": ["#e4e6ee", "#b4b9c8", "#7b8194"], "exaggerated": ["#d8e4ff", "#9fb4ff", "#6a7fe0"]},
    "warm_star_dust": {"real": ["#efe2cc", "#c9a77f", "#8a6646"], "exaggerated": ["#ffe3a0", "#ffb35a", "#d9782a"]},
    "ionized_gas": {"real": ["#f2d4da", "#d98898", "#9c3a52"], "exaggerated": ["#ff8fb8", "#ff4f7a", "#d1203c"]},
    "planetary_shell": {"real": ["#d2e6df", "#dc9aa7", "#a8475c"], "exaggerated": ["#5ef0d0", "#ff5fa0", "#ff2a40"]},
    # Hydrogen-alpha threads (first half) and their [O III] sheaths (last stop); vivid exaggerates the teal.
    "shock_filaments": {"real": ["#e8a4ac", "#c45468", "#8cbcb6"], "exaggerated": ["#ff8a6a", "#ff3355", "#00fff0"]},
    # Measured filaments (first two stops, brightest first) around a synchrotron body (last two).
    "pulsar_wind_nebula": {"real": ["#ffd6b8", "#e8604a", "#d8e2ff", "#a4b8f4"], "exaggerated": ["#ffd36a", "#ff3a2a", "#a6d8ff", "#4a7dff"]},
    # False colour for gas seen only in soft X-rays, distinct from every visible-light palette.
    "soft_xray": {"real": ["#d4d8ff", "#a4acf0", "#7880d0"], "exaggerated": ["#c0c8ff", "#7c86ff", "#5a48ff"]},
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
# Published 3D maps of the Crab: one row per point, (sky x, sky y, line-of-sight, value).
POINT_SOURCE_URL = "https://github.com/thomasorb/M1_paper/tree/af491d4a13d408464ffb3ea75e6a424f6ef5d140"
POINT_SOURCE_SHA256 = {
    "3dmap_XYZflux.fits": "da365348b258952cd9ea00292f5915c45785e1cb939ff580ad0b43ccf38d0f4e",
    "3dmap_XYZvel.fits": "0d7fbdcda2da31ce39b6ef3880e5a107d04101cd46100695c45abebd56a9c605",
}
# The released sky coordinates are registered to the WCS of the SITELLE deep frame in the same
# repository (m1.deep_frame.fits): east is minus the first column, north the second, and one map
# parsec spans 124.0 arcsec (best band-pass correlation 0.79; the other seven axis flips stay
# below 0.27). The map origin then lies 1.2 arcsec west and 1.5 arcsec north of the pulsar.
POINT_ARCSEC_PER_MAP_PC = 124.0
# Depth follows the paper's eq. 13, d = v_r / e, with Nugent (1998) e = 1.160e-3 per year,
# so it does not depend on the adopted distance. Positive depth points away from the Sun.
POINT_EXPANSION_PER_YR = 1.160e-3
PC_PER_KMS_YR = 1.0227122e-6
# Rare extreme fluxes are star residuals; the 99.9th percentile caps them.
POINT_FLUX_CAP_PERCENTILE = 99.9
# Opacity follows the square root of the summed voxel flux; the 95th percentile of the kept puffs
# maps to two thirds of the byte range, so brighter filaments keep headroom.
POINT_ALPHA_HEADROOM = 1.5
# Masks sample the 6-arcmin map at about its native pixel scale.
MASK_PIXEL_ARCMIN = 6.87
MASK_MAX_SIZE = 64
MASK_SUPERSAMPLE = 3
# Fields span 1.25 catalogued diameters; the diffuse background is measured just outside.
BACKGROUND_SCALE = 1.5
# Highlights compress like a stretched long exposure, so faint wings stay visible.
MASK_STRETCH = 0.3
# Surface brightness is expressed as Cousins R mag/arcsec^2 (Vega). One Rayleigh of H-alpha is
# 1e6/(4 pi) photons s^-1 cm^-2 sr^-1; spread over the R band's 1580 A width (Bessell 1990) against
# Vega's 2.177e-9 erg s^-1 cm^-2 A^-1 (Bessell, Castelli & Plez 1998) it is 29.46 mag/arcsec^2.
RAYLEIGH_ERG_ARCSEC2 = 1e6 / (4 * math.pi) * 6.62607015e-27 * 2.99792458e10 / 6562.8e-8 / 4.25451703e10
R_BAND_WIDTH_A = 1580
R_BAND_VEGA = 2.177e-9
# Recombination H-alpha/H-beta at 10,000 K (Osterbrock & Ferland 2006, case B).
CASE_B_HALPHA_HBETA = 2.86
# The 6-arcmin map resolves a nebula at least two beams across.
HALPHA_MIN_DIAMETER_ARCMIN = 12
# Fields span 1.25 catalogued diameters, like the masks.
HALPHA_FIELD_SCALE = 1.25
# Plate classes of the reflection nebula catalogues, brightest first, on an ordinal scale;
# 'mBr' (moderately bright) sits between bright and moderate.
REFLECTION_CLASSES = {"vBr": 0, "Br": 1, "mBr": 1.5, "M": 2, "F": 3, "vF": 4}
REFLECTION_CLASS_ALIASES = {"vB": "vBr", "B": "Br"}
SURFACE_BRIGHTNESS_SOURCES = {
    "halpha": ("Finkbeiner (2003) H-alpha map", "https://ui.adsabs.harvard.edu/abs/2003ApJS..146..407F"),
    "acker": ("Acker et al. (1992) Strasbourg-ESO catalogue", "https://vizier.cfa.harvard.edu/viz-bin/VizieR?-source=V/84"),
    "lynds": ("Lynds (1965) bright nebulae", "https://vizier.cfa.harvard.edu/viz-bin/VizieR?-source=VII/9"),
    "vdb": ("van den Bergh (1966) reflection nebulae", "https://vizier.cfa.harvard.edu/viz-bin/VizieR?-source=VII/21"),
    "vdbh": ("van den Bergh & Herbst (1975) southern reflection nebulae", "https://vizier.cfa.harvard.edu/viz-bin/VizieR?-source=VII/218"),
}


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


def load_halpha(fits_path):
    import numpy as np
    from astropy.io import fits
    digest = hashlib.sha256(Path(fits_path).read_bytes()).hexdigest()
    if digest != HALPHA_SHA256:
        raise SystemExit(f"Unexpected H-alpha map checksum {digest}")
    with fits.open(fits_path) as hdus:
        header = hdus[1].header
        if header["ORDERING"] != "NESTED" or header["NSIDE"] != 512:
            raise SystemExit("Expected the NESTED Nside 512 Finkbeiner map")
        return np.asarray(hdus[1].data["TEMPERATURE"], dtype=np.float64).ravel()


def halpha_field(rayleigh, entry):
    """Map samples (R), normalized radii and the diffuse background on the field `entry["mask"]` spans."""
    import numpy as np
    size, theta, phi, (u, v) = mask_grid(entry)
    samples = rayleigh[ang2pix_nest(512, theta, phi)]
    samples = samples.reshape(size, MASK_SUPERSAMPLE, size, MASK_SUPERSAMPLE).mean(axis=(1, 3))
    radius = np.hypot(u, v).reshape(size, MASK_SUPERSAMPLE, size, MASK_SUPERSAMPLE).mean(axis=(1, 3))
    # The diffuse warm ionized medium fills the sky; measure it in an annulus outside the field.
    _, ring_theta, ring_phi, (ring_u, ring_v) = mask_grid({**entry, "mask": {"box_arcmin": BACKGROUND_SCALE * entry["mask"]["box_arcmin"]}})
    ring_radius = np.hypot(ring_u, ring_v) * BACKGROUND_SCALE
    background = float(np.median(rayleigh[ang2pix_nest(512, ring_theta, ring_phi)][(ring_radius > 1) & (ring_radius < BACKGROUND_SCALE)]))
    return size, samples, radius, background


def build_masks(fits_path):
    import numpy as np
    rayleigh = load_halpha(fits_path)
    masks = {}
    for entry in json.loads(ADDITIONS.read_text())["objects"]:
        if "mask" not in entry:
            continue
        size, samples, radius, background = halpha_field(rayleigh, entry)
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


def build_points(directory):
    import numpy as np
    from astropy.coordinates import SkyCoord
    from astropy.io import fits
    import astropy.units as units
    columns = {}
    for name, expected in POINT_SOURCE_SHA256.items():
        path = Path(directory) / name
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != expected:
            raise SystemExit(f"Unexpected {name} checksum {digest}")
        with fits.open(path) as hdus:
            columns[name] = np.asarray(hdus[0].data, dtype=np.float64)
    flux_rows, velocity_rows = columns["3dmap_XYZflux.fits"], columns["3dmap_XYZvel.fits"]
    if not np.array_equal(flux_rows[:, :3], velocity_rows[:, :3]):
        raise SystemExit("The flux and velocity maps list different points")
    clouds = {}
    for entry in json.loads(ADDITIONS.read_text())["objects"]:
        if "points" not in entry:
            continue
        settings = entry["points"]
        distance, _, _ = adopted_distance(entry)
        pc_per_map_pc = POINT_ARCSEC_PER_MAP_PC * distance / 206264.806
        east, north = -flux_rows[:, 0] * pc_per_map_pc, flux_rows[:, 1] * pc_per_map_pc
        depth = velocity_rows[:, 3] * PC_PER_KMS_YR / POINT_EXPANSION_PER_YR
        # The app's sky axes are Galactic: rotate by the position angle of Galactic north.
        center = SkyCoord(ra=entry["ra_deg"] * units.deg, dec=entry["dec_deg"] * units.deg, frame="icrs")
        pole = SkyCoord(l=0 * units.deg, b=90 * units.deg, frame="galactic").icrs
        tilt = float(center.position_angle(pole).rad)
        galactic_north = north * math.cos(tilt) + east * math.sin(tilt)
        galactic_east = -north * math.sin(tilt) + east * math.cos(tilt)
        # The major axis of the whole cloud on the sky sets the shape's position angle.
        _, vectors = np.linalg.eigh(np.cov(np.vstack([galactic_north, galactic_east])))
        angle = math.atan2(vectors[1, 1], vectors[0, 1]) % math.pi
        major = galactic_north * math.cos(angle) + galactic_east * math.sin(angle)
        minor = -galactic_north * math.sin(angle) + galactic_east * math.cos(angle)
        flux = np.minimum(flux_rows[:, 3], np.percentile(flux_rows[:, 3], POINT_FLUX_CAP_PERCENTILE))
        local = np.column_stack([depth, major, minor])
        _, voxel = np.unique(np.floor(local / settings["voxel_pc"]).astype(np.int64), axis=0, return_inverse=True)
        voxel = voxel.ravel()
        summed = np.bincount(voxel, flux)
        centroids = np.column_stack([np.bincount(voxel, flux * local[:, axis]) / summed for axis in range(3)])
        kept = np.argsort(summed, kind="stable")[::-1][:settings["measured_puffs"]]
        opacity = np.sqrt(summed[kept] / summed[kept].max())
        opacity = np.minimum(opacity / np.percentile(opacity, 95), POINT_ALPHA_HEADROOM) / POINT_ALPHA_HEADROOM
        positions = centroids[kept]
        semi_axes = np.ceil(np.abs(positions).max(axis=0) * 1e4) / 1e4
        quantized = np.clip(np.round((positions / semi_axes + 1) * 127.5), 0, 255)
        rows = np.column_stack([quantized, np.round(opacity * 255)]).astype(np.uint8)
        # A seeded shuffle keeps every prefix an unbiased level-of-detail subset.
        rows = rows[np.random.default_rng(zlib.crc32(entry["id"].encode())).permutation(len(rows))]
        clouds[entry["id"]] = {
            "distance_pc": distance,
            "semi_axes_pc": [float(axis) for axis in semi_axes],
            "position_angle_deg": round(math.degrees(angle), 2),
            "radius_pc": settings["voxel_pc"],
            "values": base64.b64encode(rows.tobytes()).decode(),
        }
    return {
        "schemaVersion": 1,
        "source": "Martin, Milisavljevic & Drissen (2021), MNRAS 502, 1864: 3D mapping of the Crab Nebula with SITELLE",
        "url": POINT_SOURCE_URL,
        "license": "The repository is GPL-3.0; the data files state no separate license.",
        "sha256": POINT_SOURCE_SHA256,
        "method": (
            f"Released points (H-alpha, [N II] and [S II] filaments) registered to the SITELLE deep frame at {POINT_ARCSEC_PER_MAP_PC} arcsec per map pc "
            f"and rescaled to the adopted distance; depth is v_r / e with e = {POINT_EXPANSION_PER_YR} per year. Fluxes are capped at the "
            f"{POINT_FLUX_CAP_PERCENTILE}th percentile and summed in cubic voxels; the brightest voxels are kept at their flux-weighted centroids, "
            "with opacity following the square root of their flux. Offsets are quantized to 8 bits across the Galactic-frame semi-axes."
        ),
        "clouds": clouds,
    }


def rayleigh_magnitude(rayleigh):
    """H-alpha surface brightness in Rayleigh as R-band mag/arcsec^2."""
    return -2.5 * math.log10(rayleigh * RAYLEIGH_ERG_ARCSEC2 / R_BAND_WIDTH_A / R_BAND_VEGA)


def hand_rayleigh(brightness):
    """The hand-authored 0-1 scale's H-alpha equivalent: 0.45 at 100 R, 0.85 at 10,000 R."""
    return 10 * 10 ** ((brightness - 0.25) / 0.2)


def vizier_rows(path):
    """Rows of a VizieR asu-tsv table: comment lines, a header, units and dashes, then data."""
    lines = [line for line in Path(path).read_text().splitlines() if line and not line.startswith("#")]
    header = lines[0].split("\t")
    return [dict(zip(header, (cell.strip() for cell in line.split("\t")))) for line in lines[3:] if line.count("\t") == len(header) - 1]


def sexagesimal(ra, dec):
    hours, minutes, *seconds = (float(part) for part in ra.split())
    degrees, arcmin, *arcsec = (abs(float(part)) for part in dec.split())
    sign = -1 if dec.strip().startswith("-") else 1
    return 15 * (hours + minutes / 60 + sum(seconds) / 3600), sign * (degrees + arcmin / 60 + sum(arcsec) / 3600)


def separation_arcmin(ra1, dec1, ra2, dec2):
    a, b, c, d = map(math.radians, (ra1, dec1, ra2, dec2))
    return math.degrees(math.acos(max(-1, min(1, math.sin(b) * math.sin(d) + math.cos(b) * math.cos(d) * math.cos(a - c))))) * 60


def compact_name(name):
    """'Sh 2-27', 'S 27' -> 'S27'; 'IC  432' -> 'IC432'."""
    return name.replace("Sh 2-", "S").replace(" ", "")


def lynds_match(row, lynds):
    """The LBN record a designation names, else the one named like the nebula, else the largest nearby of similar size."""
    details = row["nebula"]
    for designation in details["designations"]:
        if designation.startswith("LBN "):
            label = designation[4:]
            for record in lynds:
                if record["Seq"] == label or f"{float(record['GLON']):06.2f}{float(record['GLAT']):+06.2f}" == label:
                    return record
    names = {compact_name(designation) for designation in details["designations"] + [row["name"]]}
    radius = max(max(details["angular_size_arcmin"]) / 2, 10)
    nearby = [record for record in lynds if separation_arcmin(details["ra_deg"], details["dec_deg"], *record["position"]) <= radius]
    named = [record for record in nearby if record["Name"] and compact_name(record["Name"]) in names]
    similar = [record for record in nearby if 0.5 <= int(record["Diam1"] or 0) / max(details["angular_size_arcmin"]) <= 2]
    return (named or sorted(similar, key=lambda record: -int(record["Diam1"])) or [None])[0]


def reflection_class(row, vdb, vdbh):
    """The brightest van den Bergh (or van den Bergh & Herbst) plate class among the nebula's designations."""
    found = []
    for designation in row["nebula"]["designations"]:
        catalogue, _, number = designation.partition(" ")
        if catalogue in ("vdB", "vdBH") and number.isdigit():
            records = vdb if catalogue == "vdB" else vdbh
            key = "VdB" if catalogue == "vdB" else "BHe"
            found += [(REFLECTION_CLASS_ALIASES.get(value, value), catalogue)
                      for record in records if record[key] == number
                      for value in [record["SurfBr" if catalogue == "vdB" else "Br"].rstrip(":")] if value]
    return min(found, key=lambda item: REFLECTION_CLASSES[item[0]], default=None)


def acker_flux(row, main, diameters, fluxes):
    """Observed H-beta flux and optical diameter of the Strasbourg-ESO PN at the nebula's position."""
    details = row["nebula"]
    nearest = min(main, key=lambda record: separation_arcmin(details["ra_deg"], details["dec_deg"], *record["position"]))
    if separation_arcmin(details["ra_deg"], details["dec_deg"], *nearest["position"]) > 1:
        return None
    diameter, flux = diameters.get(nearest["PNG"], {}).get("oDiam"), fluxes.get(nearest["PNG"], {}).get("log(Fbeta)")
    return (nearest, float(flux), float(diameter)) if diameter and flux else None


def build_surface_brightness(directory):
    """One surface brightness per nebula, measured where a catalogue resolves it and estimated from plate classes otherwise."""
    import numpy as np
    from statistics import median
    directory = Path(directory)
    rayleigh = load_halpha(directory / "lambda_halpha_fwhm06_0512.fits")
    table = lambda name: vizier_rows(directory / f"{name}.tsv")
    lynds = table("VII_9")
    for record in lynds:
        record["position"] = sexagesimal(record["_RA.icrs"], record["_DE.icrs"])
    vdb, vdbh, main = table("VII_21"), table("VII_218"), table("V_84_main")
    for record in main:
        record["position"] = sexagesimal(record["_RA.icrs"], record["_DE.icrs"])
    first = lambda rows: {record["PNG"]: record for record in reversed(rows)}
    diameters, fluxes = first(table("V_84_diam")), first(table("V_84_hbeta"))
    masks = json.loads(MASKS.read_text())["masks"]
    previous = json.loads(SURFACE_BRIGHTNESS.read_text())["nebulae"] if SURFACE_BRIGHTNESS.exists() else {}
    hand = {entry["id"]: entry["brightness"] for entry in json.loads(ADDITIONS.read_text())["objects"] if "brightness" in entry}
    rows = json.loads((OVERLAY / "objects.json").read_text())["objects"]

    def field_peak(row):
        details = row["nebula"]
        diameter = max(details["angular_size_arcmin"])
        entry = {"ra_deg": details["ra_deg"], "dec_deg": details["dec_deg"], "mask": {"box_arcmin": HALPHA_FIELD_SCALE * diameter}}
        _, samples, radius, background = halpha_field(rayleigh, entry)
        return float(np.max((samples - background)[radius <= 1 / HALPHA_FIELD_SCALE]))

    def halpha_record(peak, scope):
        label, url = SURFACE_BRIGHTNESS_SOURCES["halpha"]
        return {"mag_arcsec2": rayleigh_magnitude(max(peak, 0.1)), "estimated": False,
                "source": f"{label}: {scope} {peak:.1f} R above the diffuse background at 6 arcmin resolution", "url": url,
                "basis": {"halpha_peak_excess_rayleigh": round(peak, 2)}}

    measured, pending = {}, {}
    for row in rows:
        identifier, kind, details = row["id"], row["type"], row["nebula"]
        diameter = max(details["angular_size_arcmin"])
        lynds_record = lynds_match(row, lynds)
        pending[identifier] = {
            "lynds": {"seq": int(lynds_record["Seq"]), "class": int(lynds_record["Bright"])} if lynds_record and lynds_record["Bright"] not in ("", "0") else None,
            "reflection": reflection_class(row, vdb, vdbh) if kind == "reflection_nebula" else None,
            "hand": hand.get(identifier, details.get("brightness", previous.get(identifier, {}).get("basis", {}).get("retired_brightness"))),
        }
        acker = acker_flux(row, main, diameters, fluxes) if kind == "planetary_nebula" else None
        if acker:
            record, log_flux, arcsec = acker
            halpha = CASE_B_HALPHA_HBETA * 10 ** log_flux / (math.pi * (arcsec / 2) ** 2) / RAYLEIGH_ERG_ARCSEC2
            label, url = SURFACE_BRIGHTNESS_SOURCES["acker"]
            measured[identifier] = {"mag_arcsec2": rayleigh_magnitude(halpha), "estimated": False,
                "source": f"{label}: mean over the {arcsec:g}-arcsec disk of the observed H-beta flux 10^{log_flux:g} erg/s/cm^2 (PN G{record['PNG']}), as H-alpha at the case-B ratio {CASE_B_HALPHA_HBETA}",
                "url": url, "basis": {"png": record["PNG"], "log_hbeta_flux": log_flux, "diameter_arcsec": arcsec}}
        elif identifier in masks:
            measured[identifier] = halpha_record(masks[identifier]["peak_excess_rayleigh"], "peak")
        elif kind in ("hii_region", "planetary_nebula") and diameter >= HALPHA_MIN_DIAMETER_ARCMIN:
            measured[identifier] = halpha_record(field_peak(row), "peak")
        elif kind == "supernova_remnant" and diameter >= HALPHA_MIN_DIAMETER_ARCMIN:
            # The map cannot isolate a remnant's shell, but its peak in the field bounds it.
            pending[identifier]["upper_limit_rayleigh"] = round(field_peak(row), 2)

    # Plate classes step about a magnitude each; their zero point follows the H-alpha measurements they overlap.
    lynds_offset = median(record["mag_arcsec2"] - pending[identifier]["lynds"]["class"]
                          for identifier, record in measured.items() if pending[identifier]["lynds"])
    # Reflection classes map linearly onto the Lynds classes of the nebulae both catalogues list.
    overlaps = [(REFLECTION_CLASSES[item["reflection"][0]], item["lynds"]["class"]) for item in pending.values() if item["reflection"] and item["lynds"]]
    slope, intercept = np.polyfit(*zip(*overlaps), 1)
    reflection_level = {name: round(float(intercept + slope * index), 2) for name, index in REFLECTION_CLASSES.items()}
    # The hand scale keeps its slope; its zero point follows the measurements it overlaps.
    hand_offset = median(record["mag_arcsec2"] - rayleigh_magnitude(hand_rayleigh(pending[identifier]["hand"]))
                         for identifier, record in measured.items() if pending[identifier]["hand"] is not None)

    nebulae = {}
    for row in rows:
        identifier, item = row["id"], pending[row["id"]]
        if identifier in measured:
            record = measured[identifier]
        elif item["reflection"]:
            name, catalogue = item["reflection"]
            label, url = SURFACE_BRIGHTNESS_SOURCES[catalogue.lower()]
            record = {"mag_arcsec2": lynds_offset + reflection_level[name], "estimated": True,
                      "source": f"{label}: plate class {name}, placed on the Lynds (1965) scale where the catalogues overlap and calibrated against the measurements",
                      "url": url, "basis": {"plate_class": name, "catalogue": catalogue}}
        elif item["lynds"]:
            label, url = SURFACE_BRIGHTNESS_SOURCES["lynds"]
            record = {"mag_arcsec2": lynds_offset + item["lynds"]["class"], "estimated": True,
                      "source": f"{label}: brightness class {item['lynds']['class']} of 6 (LBN {item['lynds']['seq']}), one magnitude per class calibrated against the measurements",
                      "url": url, "basis": {"lbn": item["lynds"]["seq"], "lynds_class": item["lynds"]["class"]}}
        elif item["hand"] is not None:
            magnitude = rayleigh_magnitude(hand_rayleigh(item["hand"])) + hand_offset
            source = "Hand-authored visual estimate, calibrated against the measurements"
            basis = {}
            if "upper_limit_rayleigh" in item:
                limit = rayleigh_magnitude(max(item["upper_limit_rayleigh"], 0.1))
                basis["halpha_field_peak_rayleigh"] = item["upper_limit_rayleigh"]
                if limit > magnitude:
                    magnitude = limit
                    source = f"Hand-authored visual estimate, capped at the {item['upper_limit_rayleigh']:.1f} R H-alpha peak of its field in the Finkbeiner (2003) map"
            record = {"mag_arcsec2": magnitude, "estimated": True, "source": source, "url": None, "basis": basis}
        else:
            raise SystemExit(f"No surface brightness for {identifier}")
        # The retired 0-1 brightness stays on record wherever it existed.
        basis = {**record["basis"], **({"retired_brightness": item["hand"]} if item["hand"] is not None else {})}
        nebulae[identifier] = {**record, "mag_arcsec2": round(record["mag_arcsec2"], 2), "basis": basis}
    return {
        "schemaVersion": 1,
        "sources": {key: {"label": label, "url": url} for key, (label, url) in SURFACE_BRIGHTNESS_SOURCES.items()},
        "method": (
            "R-band mag/arcsec^2 (Vega). Planetary nebulae take the mean of their Strasbourg-ESO H-beta flux over the optical disk; "
            f"emission nebulae at least {HALPHA_MIN_DIAMETER_ARCMIN} arcmin across take the peak H-alpha excess of the 6-arcmin Finkbeiner map within "
            "their catalogued extent (the frozen mask peak where a mask exists). Others are estimated from photographic plate classes: "
            f"Lynds classes step one magnitude each from a zero point of {lynds_offset:.2f} (the median offset of the measurements they overlap), "
            "and reflection-nebula classes map linearly onto the Lynds classes of the nebulae both catalogues list. The remaining few keep their "
            f"hand estimate, shifted by {hand_offset:.2f} mag (the median offset of the measurements it overlaps); supernova remnants the map "
            "cannot isolate are capped at the H-alpha peak of their field."
        ),
        "calibration": {"lynds_offset_mag": round(lynds_offset, 2), "reflection_lynds_class": reflection_level, "hand_offset_mag": round(hand_offset, 2)},
        "nebulae": nebulae,
    }


def mask_puff_count(mask):
    """One puff per lit pixel; src/nebula-layer.ts weights each by the pixel's brightness."""
    return max(16, min(4096, sum(value > 0 for value in base64.b64decode(mask["values"]))))


def nebula_row(entry, masks, points):
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
    elif "points" in entry:
        cloud = points["clouds"][entry["id"]]
        if cloud["distance_pc"] != distance or cloud["radius_pc"] != entry["points"]["voxel_pc"]:
            raise SystemExit(f"Stale point cloud for {entry['id']}; rebuild with --points")
        shape = {"kind": "points", "semi_axes_pc": cloud["semi_axes_pc"], "position_angle_deg": cloud["position_angle_deg"],
                 "layer_offsets_pc": [], "points": {"radius_pc": cloud["radius_pc"], "values": cloud["values"]}}
        puff_count = len(base64.b64decode(cloud["values"])) // 4 + entry["points"]["body_puffs"]
    else:
        # Without a measured orientation, an equal-area circle avoids inventing one.
        radius = semi_axis(distance, math.sqrt(major * minor))
        shape = {"kind": entry["shape"], "semi_axes_pc": [radius, radius, radius], "position_angle_deg": 0, "layer_offsets_pc": []}
        puff_count = entry.get("puff_count", max(64, min(1024, round(1.2 * math.sqrt(major * minor)))))
    details.update({
        "shape": shape,
        "palette": PALETTES[entry["palette"]],
        "puff_count": puff_count,
        "seed": zlib.crc32(entry["id"].encode()) % 9000 + 1000,
        "source_label": entry["source_label"],
        "source_url": entry["source_url"],
        "model_note": entry["model_note"],
        **({"remnant": entry["remnant"]} if "remnant" in entry else {}),
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


def with_surface_brightness(row, records):
    """The row with its surface brightness after the palette, replacing the retired 0-1 hand scale."""
    if row["id"] not in records:
        raise SystemExit(f"No surface brightness for {row['id']}; rebuild with --surface-brightness")
    record = records[row["id"]]
    details = {}
    for key, value in row["nebula"].items():
        if key in ("brightness", "surface_brightness_mag_arcsec2", "surface_brightness_source", "surface_brightness_estimated"):
            continue
        details[key] = value
        if key == "palette":
            details.update({
                "surface_brightness_mag_arcsec2": record["mag_arcsec2"],
                "surface_brightness_source": record["source"],
                "surface_brightness_estimated": record["estimated"],
            })
    return {**row, "nebula": details}


def render():
    additions = json.loads(ADDITIONS.read_text())["objects"]
    masks = json.loads(MASKS.read_text())
    points = json.loads(POINTS.read_text())
    surface_brightness = json.loads(SURFACE_BRIGHTNESS.read_text())["nebulae"]
    payload = json.loads((OVERLAY / "objects.json").read_text())
    listed = {entry["id"] for entry in additions}
    objects = [row for row in payload["objects"] if row["id"] not in listed] + [nebula_row(entry, masks, points) for entry in additions]
    objects = [with_surface_brightness(row, surface_brightness) for row in objects]
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
    parser.add_argument("--points", metavar="M1_PAPER_DIR", help="Rebuild the frozen Crab Nebula point cloud from the released 3D maps")
    parser.add_argument("--surface-brightness", metavar="SOURCE_DIR", help="Rebuild the frozen surface brightness from the H-alpha map and VizieR tables")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.masks:
        MASKS.write_text(json.dumps(build_masks(args.masks), indent=2) + "\n")
    if args.points:
        POINTS.write_text(json.dumps(build_points(args.points), indent=2) + "\n")
    if args.surface_brightness:
        SURFACE_BRIGHTNESS.write_text(json.dumps(build_surface_brightness(args.surface_brightness), indent=2, ensure_ascii=False) + "\n")
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
