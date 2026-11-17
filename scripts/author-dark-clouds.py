"""Measure the dust clouds and dark nebulae within 1000 ly from 3D dust maps.

Freezes catalog-work/molecular-clouds/additions.json, which
scripts/author-molecular-clouds.mjs merges into the molecular-cloud overlay:

- New clouds. The Edenhofer et al. (2024) map is resampled to a 1-pc grid and
  segmented with the boundary and minimum structure size of Cahlon et al.
  (2024): connected voxels above n_H = 25 cm^-3, at least 150 voxels. Cahlon's
  500 Msun floor is not applied, so the small nearby clouds it drops are kept.
  Voxels within 6 pc of a Cahlon cloud are already drawn, and a remaining
  feature that covers the same sky as a drawn cloud at a similar distance is
  that cloud displaced between the two maps; both are skipped. Corona
  Australis comes from the Leike et al. (2020) cutout of Zucker et al. (2021),
  the map Cahlon segmented, because Edenhofer places most of its dust about
  70 pc behind the Gaia distance of its young stars.
- Dark nebulae of Lynds (1962), Feitzinger & Stuewe (1984) and Barnard (1927).
  A Zucker et al. (2020) distance measured inside the nebula is adopted;
  otherwise the nearest dust layer along the nebula that holds at least half
  the column of the strongest layer within 1.25 kpc. Each nebula is anchored
  to the cloud whose voxels fill its outline at that distance.

  python3 scripts/author-dark-clouds.py --measure <directory>

The directory holds mean_and_std_healpix.fits (Edenhofer et al. 2024, Zenodo
8187943), Galactic_Positions_For_All_Filtered_Clouds_Table1_Cahlon2023.fits
(Harvard Dataverse 7280031), coraus_3D_density.fits (Dataverse 4327240) and
the VizieR tables VII_7A.tsv, VII_220A.tsv, VII_68.tsv and J_A_A_633_A51.tsv
(asu-tsv, -out.all=1, -out.max=unlimited).
"""

import argparse
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "catalog-work/molecular-clouds/additions.json"
REVIEW = ROOT / "catalog-work/molecular-clouds/review.json"

CHECKSUMS = {
    "mean_and_std_healpix.fits": "7c36dd928afcd2a774ce746ccddba95a1d8490d7a034073fd622c57217c63ae6",
    "Galactic_Positions_For_All_Filtered_Clouds_Table1_Cahlon2023.fits": "bbad4cfb1f2787074451a35ca54d1c557ba5c014a169510fbe22ceeb30fb75bb",
    "coraus_3D_density.fits": "fc079073396b029aba3847308f12c07df85d37b48d359cbbdc67a7e60ad1cb7d",
}

LY_PER_PC = 3.26156
SCOPE_PC = 1000 / LY_PER_PC
GRID_RADIUS_PC = 360
# ZGR23 extinction to A_V (Edenhofer et al. 2024) and N_H / A_V = 2.21e21 cm^-2 (Guever & Oezel 2009), per parsec.
N_PER_E = 2.8 * 2.21e21 / 3.086e18
N_MIN = 25.0
MIN_VOXELS = 150
DRAWN_MARGIN_PC = 6
SOLAR_MASS_PER_VOXEL_N1 = 1.37 * 1.6726e-24 * 3.0857e18 ** 3 / 1.989e33
NSIDE = 256


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1 << 24), b""):
            digest.update(block)
    return digest.hexdigest()


def spread_bits(values):
    import numpy as np
    values = values.astype(np.int64)
    out = np.zeros_like(values)
    for bit in range(20):
        out |= ((values >> bit) & 1) << (2 * bit)
    return out


def vec2pix_nest(x, y, z):
    """HEALPix NEST pixels of unit vectors; matches ang2pix_nest in author-nebulae.py."""
    import numpy as np
    z = np.clip(z, -1, 1)
    tt = (np.arctan2(y, x) % (2 * np.pi)) / (np.pi / 2)
    za = np.abs(z)
    face = np.empty(z.shape, np.int64)
    ix = np.empty(z.shape, np.int64)
    iy = np.empty(z.shape, np.int64)
    eq = za <= 2 / 3
    temp1 = NSIDE * (0.5 + tt[eq])
    temp2 = NSIDE * (z[eq] * 0.75)
    jp = (temp1 - temp2).astype(np.int64)
    jm = (temp1 + temp2).astype(np.int64)
    ifp, ifm = jp // NSIDE, jm // NSIDE
    face[eq] = np.where(ifp == ifm, ifp % 4 + 4, np.where(ifp < ifm, ifp % 4, ifm % 4 + 8))
    ix[eq] = jm & (NSIDE - 1)
    iy[eq] = NSIDE - (jp & (NSIDE - 1)) - 1
    cap = ~eq
    ntt = np.minimum(tt[cap].astype(np.int64), 3)
    tp = tt[cap] - ntt
    tmp = NSIDE * np.sqrt(3 * (1 - za[cap]))
    jp = np.minimum((tp * tmp).astype(np.int64), NSIDE - 1)
    jm = np.minimum(((1 - tp) * tmp).astype(np.int64), NSIDE - 1)
    north = z[cap] >= 0
    face[cap] = np.where(north, ntt, ntt + 8)
    ix[cap] = np.where(north, NSIDE - jm - 1, jp)
    iy[cap] = np.where(north, NSIDE - jp - 1, jm)
    return face * NSIDE * NSIDE + spread_bits(ix) + (spread_bits(iy) << 1)


def galactic(vector):
    x, y, z = (float(value) for value in vector)
    distance = math.sqrt(x * x + y * y + z * z)
    return distance, math.degrees(math.atan2(y, x)) % 360, math.degrees(math.asin(z / distance))


def unit(l_deg, b_deg):
    import numpy as np
    l, b = np.radians(l_deg), np.radians(b_deg)
    return np.stack([np.cos(b) * np.cos(l), np.cos(b) * np.sin(l), np.sin(b)], -1)


class DustMap:
    def __init__(self, path):
        import numpy as np
        from astropy.io import fits
        self.hdus = fits.open(path, memmap=True)
        self.bounds = np.asarray(self.hdus["RADIAL PIXEL BOUNDARIES"].data["radial pixel boundaries"], float)
        self.centers = np.asarray(self.hdus["RADIAL PIXEL CENTERS"].data["radial pixel centers"], float)
        self.widths = np.diff(self.bounds)
        self.mean = np.asarray(self.hdus["MEAN"].data)

    def shell(self, radius):
        import numpy as np
        return np.searchsorted(self.bounds, radius) - 1


def dense_voxels(dust):
    """Integer Galactic positions (pc) and n_H of every 1-pc voxel above N_MIN within the grid."""
    import numpy as np
    axis = np.arange(-GRID_RADIUS_PC, GRID_RADIUS_PC + 1)
    x, y = np.meshgrid(axis, axis, indexing="ij")
    points, densities = [], []
    for z in axis:
        radius = np.sqrt(x * x + y * y + z * z)
        inside = (radius <= GRID_RADIUS_PC) & (radius >= dust.bounds[0])
        pixels = vec2pix_nest(x[inside] / radius[inside], y[inside] / radius[inside], z / radius[inside])
        density = dust.mean[dust.shell(radius[inside]), pixels] * N_PER_E
        keep = density > N_MIN
        points.append(np.stack([x[inside][keep], y[inside][keep], np.full(keep.sum(), z)], 1))
        densities.append(density[keep])
    return np.concatenate(points).astype(np.int64), np.concatenate(densities).astype(np.float64)


def keys(points):
    span = 2 * GRID_RADIUS_PC + 64
    shifted = points + GRID_RADIUS_PC + 32
    return (shifted[:, 0] * span + shifted[:, 1]) * span + shifted[:, 2]


def components(points):
    """Labels of 6-connected components of integer voxel positions."""
    import numpy as np
    key = keys(points)
    order = np.argsort(key)
    sorted_keys = key[order]
    edges = []
    for offset in ([1, 0, 0], [0, 1, 0], [0, 0, 1]):
        neighbour = keys(points + np.array(offset))
        found = np.searchsorted(sorted_keys, neighbour)
        found = np.minimum(found, len(sorted_keys) - 1)
        hit = sorted_keys[found] == neighbour
        edges.append(np.stack([np.nonzero(hit)[0], order[found[hit]]], 1))
    edges = np.concatenate(edges)
    labels = np.arange(len(points))
    while True:
        low = np.minimum(labels[edges[:, 0]], labels[edges[:, 1]])
        updated = labels.copy()
        np.minimum.at(updated, edges[:, 0], low)
        np.minimum.at(updated, edges[:, 1], low)
        updated = updated[updated]
        if np.array_equal(updated, labels):
            return labels
        labels = updated


def near(points, reference, margin):
    """Whether each voxel lies within `margin` pc (Chebyshev) of a reference voxel."""
    import numpy as np
    span = np.arange(-margin, margin + 1)
    offsets = np.stack(np.meshgrid(span, span, span, indexing="ij"), -1).reshape(-1, 3)
    grown = np.unique(np.concatenate([keys(reference + offset) for offset in offsets]))
    return np.isin(keys(points), grown)


def sky_cells(points, nside_shift=4):
    """Coarse HEALPix (Nside 16) cells a voxel set covers."""
    import numpy as np
    vectors = points / np.linalg.norm(points, axis=1)[:, None]
    return set((vec2pix_nest(vectors[:, 0], vectors[:, 1], vectors[:, 2]) >> (2 * nside_shift)).tolist())


def cloud_record(points, densities):
    import numpy as np
    weights = densities / densities.sum()
    center = np.rint((points * weights[:, None]).sum(0)).astype(int)
    distance, longitude, latitude = galactic(center)
    radius = (3 * len(points) / (4 * math.pi)) ** (1 / 3)
    return {
        "center_pc": center.tolist(),
        "distance_pc": round(distance),
        "galactic_longitude_deg": round(longitude, 1),
        "galactic_latitude_deg": round(latitude, 1),
        "mass_solar": round(float(densities.sum() * SOLAR_MASS_PER_VOXEL_N1)),
        "mean_density_cm3": round(float(densities.mean())),
        "peak_density_cm3": round(float(densities.max())),
        "equivalent_radius_pc": round(radius, 1),
        "surface_area_pc2": round(math.pi * radius * radius),
        "volume_pc3": len(points),
    }


def leike_cutout(path):
    """Voxels above N_MIN in the Zucker et al. (2021) Leike cutout of Corona Australis, already in n_H."""
    import numpy as np
    from astropy.io import fits
    with fits.open(path) as hdus:
        data = np.asarray(hdus[0].data, float)
        header = hdus[0].header
    z, y, x = np.nonzero(data > N_MIN)
    points = np.stack([x + header["CRVAL1"], y + header["CRVAL2"], z + header["CRVAL3"]], 1).astype(np.int64)
    labels = components(points)
    # The 25 cm^-3 isosurface splits the cloud into its body and the dense head around R CrA; both are kept.
    keep = np.bincount(labels)[labels] >= 100
    return points[keep], data[z[keep], y[keep], x[keep]]


def vizier_rows(path):
    rows, header, skip = [], None, 0
    for line in Path(path).read_text().splitlines():
        if line.startswith("#") or not line.strip():
            header = None if not line.strip() else header
            continue
        cells = [cell.strip() for cell in line.split("\t")]
        if cells[0] == "recno":
            header, skip = cells, 2
            continue
        if skip:
            skip -= 1
            continue
        if header and len(cells) == len(header):
            rows.append(dict(zip(header, cells)))
    return rows


def dark_nebula_sources(directory):
    """Lynds, Feitzinger & Stuewe and Barnard entries merged by their cross-references."""
    lynds = vizier_rows(directory / "VII_7A.tsv")
    barnard = {int(row["Barn"]): row for row in vizier_rows(directory / "VII_220A.tsv") if row["Barn"].strip().isdigit()}
    southern = vizier_rows(directory / "VII_68.tsv")
    entries, claimed = [], set()
    for row in lynds:
        # Seven rows of the revised catalogue have no LDN number, so no designation to show.
        if not row["LDN"]:
            continue
        numbers =[int(value) for value in row["Barn"].replace(",", " ").split() if value.isdigit()]
        claimed.update(numbers)
        area = float(row["Area"]) if row["Area"] else 0.0
        entries.append({
            "key": f"ldn-{int(row['LDN'])}",
            "designations": [f"LDN {int(row['LDN'])}", *[f"Barnard {number}" for number in numbers]],
            "l": float(row["GLON"]), "b": float(row["GLAT"]),
            "radius_deg": math.sqrt(area / math.pi) if area > 0 else 0.05,
            "area_deg2": area, "opacity_class": int(row["Opacity"]) if row["Opacity"] else None,
            "catalog": "Lynds (1962)",
        })
    lynds_count = len(entries)
    for row in southern:
        # Only "S n" cross-references (Sandqvist 1977) have SIMBAD designations; "SL n" (Sandqvist & Lindroos 1976) do not.
        ident = row["Ident"].replace(",", " ").split()
        sandqvist = [f"Sandqvist {int(value)}" for marker, value in zip(ident, ident[1:]) if marker == "S" and value.isdigit()]
        designations = [f"FeSt 1-{int(row['FEST'])}", *sandqvist]
        l, b = float(row["GLON"]), float(row["GLAT"])
        # Where the surveys overlap, a nebula already in Lynds keeps its Lynds record.
        same = next((entry for entry in entries[:lynds_count]
                     if separation_deg(l, b, entry["l"], entry["b"]) <= max(entry["radius_deg"], 0.1)), None)
        if same:
            same["designations"] += designations
            continue
        area = float(row["Area"]) if row["Area"] else 0.0
        entries.append({
            "key": f"fest-1-{int(row['FEST'])}", "designations": designations, "l": l, "b": b,
            "radius_deg": math.sqrt(area / math.pi) if area > 0 else 0.05,
            "area_deg2": area, "opacity_class": int(row["OpClass"]) if row["OpClass"] else None,
            "catalog": "Feitzinger & Stuewe (1984)",
        })
    return entries, barnard, claimed


def footprint_pixels(l, b, radius_deg):
    import numpy as np
    step = max(min(radius_deg / 6, 0.05), 0.01)
    count = int(math.ceil(radius_deg / step))
    offsets = np.arange(-count, count + 1) * step
    east, north = np.meshgrid(offsets, offsets)
    inside = east ** 2 + north ** 2 <= radius_deg ** 2
    east, north = np.radians(east[inside]), np.radians(north[inside])
    rho = np.hypot(east, north)
    c = np.arctan(rho)
    lr, br = math.radians(l), math.radians(b)
    with np.errstate(invalid="ignore", divide="ignore"):
        latitude = np.arcsin(np.cos(c) * math.sin(br) + np.where(rho > 0, north * np.sin(c) * math.cos(br) / rho, 0))
        longitude = lr + np.arctan2(east * np.sin(c), rho * math.cos(br) * np.cos(c) - north * math.sin(br) * np.sin(c))
    pixels = vec2pix_nest(np.cos(latitude) * np.cos(longitude), np.cos(latitude) * np.sin(longitude), np.sin(latitude))
    unique, counts = np.unique(pixels, return_counts=True)
    return unique, counts / counts.sum()


def dust_layers(dust, density, floor=5.0, relative=0.15, gap=3):
    """Contiguous dust layers along a sightline with their column-weighted median and 16th/84th percentiles."""
    import numpy as np
    above = density > max(floor, relative * density.max())
    index = np.nonzero(above)[0]
    if not len(index):
        return []
    groups, start, previous = [], index[0], index[0]
    for value in index[1:]:
        if value - previous > gap:
            groups.append((start, previous))
            start = value
        previous = value
    groups.append((start, previous))
    layers = []
    for first, last in groups:
        column = density[first:last + 1] * dust.widths[first:last + 1]
        cumulative = np.cumsum(column) / column.sum()
        radii = dust.centers[first:last + 1]
        quantile = lambda share: float(np.interp(share, cumulative, radii))
        layers.append({"column": float(column.sum()), "distance": quantile(0.5), "low": quantile(0.16), "high": quantile(0.84)})
    return layers


def separation_deg(l1, b1, l2, b2):
    l1, b1, l2, b2 = map(math.radians, (l1, b1, l2, b2))
    cosine = math.sin(b1) * math.sin(b2) + math.cos(b1) * math.cos(b2) * math.cos(l1 - l2)
    return math.degrees(math.acos(max(-1.0, min(1.0, cosine))))


CONTRAST_MIN = 100.0  # cm^-3 pc, A_V of about 0.14 mag


def contrast_layers(dust, l, b, radius_deg):
    """Layers where the nebula holds more dust than a ring around it; the map resolves about 0.23 deg."""
    import numpy as np
    inner_radius = max(radius_deg, 0.12)
    pixels, weights = footprint_pixels(l, b, inner_radius)
    ring_inner = max(2 * inner_radius, 0.4)
    ring_pixels, ring_weights = footprint_pixels(l, b, ring_inner + max(inner_radius, 0.4))
    inside, _ = footprint_pixels(l, b, ring_inner)
    keep = ~np.isin(ring_pixels, inside)
    ring_pixels, ring_weights = ring_pixels[keep], ring_weights[keep] / ring_weights[keep].sum()
    contrast = (dust.mean[:, pixels] * weights).sum(1) - (dust.mean[:, ring_pixels] * ring_weights).sum(1)
    contrast = np.clip(contrast * N_PER_E, 0, None)
    contrast[dust.centers > 1250] = 0
    return dust_layers(dust, contrast, floor=2.0) if contrast.max() > 0 else []


def own_geometry(dust, entry, low, high):
    """1-pc voxels of a nebula that no drawn cloud holds: inside its outline and dust layer, above half the layer's peak."""
    import numpy as np
    radius = max(entry["radius_deg"], 0.12)
    near_edge, far_edge = max(low - 3, dust.bounds[0]), high + 3
    direction = unit(entry["l"], entry["b"])
    reach = far_edge * math.sin(math.radians(radius)) + 1
    center = direction * (near_edge + far_edge) / 2
    half = np.ceil(np.abs(direction) * (far_edge - near_edge) / 2 + reach).astype(int)
    axes = [np.arange(math.floor(center[axis]) - half[axis], math.ceil(center[axis]) + half[axis] + 1) for axis in range(3)]
    grid = np.stack(np.meshgrid(*axes, indexing="ij"), -1).reshape(-1, 3)
    distance = np.linalg.norm(grid, axis=1)
    # Within the outline, or within 1 pc of its axis where the outline is narrower than a voxel.
    along = grid @ direction
    across = np.sqrt(np.maximum(distance * distance - along * along, 0))
    inside = (across <= np.maximum(along * math.tan(math.radians(radius)), 1.0)) & (along > 0) & (distance >= near_edge) & (distance <= far_edge)
    grid, distance = grid[inside], distance[inside]
    vectors = grid / distance[:, None]
    density = dust.mean[dust.shell(distance), vec2pix_nest(vectors[:, 0], vectors[:, 1], vectors[:, 2])] * N_PER_E
    keep = density >= 0.5 * density.max()
    order = np.lexsort(grid[keep].T[::-1])
    return {
        "voxels_pc": grid[keep][order].ravel().tolist(),
        "mean_density_cm3": round(float(density[keep].mean()), 1),
        "peak_density_cm3": round(float(density[keep].max()), 1),
    }


def measure(directory):
    import numpy as np
    from astropy.io import fits
    for name, expected in CHECKSUMS.items():
        if expected and sha256(directory / name) != expected:
            raise SystemExit(f"Unexpected checksum for {name}")
    dust = DustMap(directory / "mean_and_std_healpix.fits")

    with fits.open(directory / "Galactic_Positions_For_All_Filtered_Clouds_Table1_Cahlon2023.fits") as hdus:
        table = hdus[1].data
        cahlon_ids = np.asarray(table["ComponentId"])
        cahlon_points = np.stack([table["x"], table["y"], table["z"]], 1).astype(np.int64)
    drawn = {f"cahlon-cloud-{int(cloud)}": cahlon_points[cahlon_ids == cloud] for cloud in np.unique(cahlon_ids)}
    crown_points, crown_density = leike_cutout(directory / "coraus_3D_density.fits")
    clouds = [{
        "id": "corona-australis-molecular-cloud", "source": "leike-cutout",
        **cloud_record(crown_points, crown_density), "points": crown_points, "density": crown_density,
    }]
    drawn[clouds[0]["id"]] = crown_points

    points, densities = dense_voxels(dust)
    reference = np.concatenate(list(drawn.values()))
    fresh = ~near(points, reference, DRAWN_MARGIN_PC)
    points, densities = points[fresh], densities[fresh]
    labels = components(points)
    sizes = np.bincount(labels)
    drawn_sky = {name: (sky_cells(voxels), float(np.linalg.norm(voxels.mean(0)))) for name, voxels in drawn.items()}
    skipped, duplicates = [], {}
    for label in np.nonzero(sizes >= MIN_VOXELS)[0]:
        member = labels == label
        record = cloud_record(points[member], densities[member])
        if record["distance_pc"] > SCOPE_PC:
            continue
        cells = sky_cells(points[member])
        duplicate = next((name for name, (sky, distance) in drawn_sky.items()
                          if len(cells & sky) >= 0.5 * len(cells) and abs(record["distance_pc"] - distance) < 0.5 * distance), None)
        if duplicate:
            skipped.append({**record, "same_as": duplicate})
            duplicates.setdefault(duplicate, []).append(points[member])
            continue
        name = f"G{record['galactic_longitude_deg']:05.1f}{record['galactic_latitude_deg']:+05.1f}"
        clouds.append({"id": f"dust-cloud-{name.lower().replace('+', 'p').replace('-', 'm').replace('.', '')}",
                       "source": "edenhofer", "map_name": name, **record,
                       "points": points[member], "density": densities[member]})

    # Voxels of every drawn cloud, for anchoring. Edenhofer copies of a drawn cloud anchor to that cloud.
    owned = [(name, voxels, True) for name, voxels in drawn.items()]
    owned += [(cloud["id"], cloud["points"], True) for cloud in clouds if cloud["source"] == "edenhofer"]
    owned += [(name, voxels, False) for name, copies in duplicates.items() for voxels in copies]
    anchor_names = list(dict.fromkeys(name for name, _, _ in owned))
    anchor_points = np.concatenate([voxels for _, voxels, _ in owned]).astype(float)
    anchor_owner = np.concatenate([np.full(len(voxels), anchor_names.index(name)) for name, voxels, _ in owned])
    anchor_own_map = np.concatenate([np.full(len(voxels), own) for _, voxels, own in owned])
    anchor_distance = np.linalg.norm(anchor_points, axis=1)
    anchor_direction = anchor_points / anchor_distance[:, None]

    zucker = [row for row in vizier_rows(directory / "J_A_A_633_A51.tsv") if row.get("d50")]
    entries, barnard, claimed = dark_nebula_sources(directory)
    for number, row in barnard.items():
        if number in claimed:
            continue
        diameter = float(row["Diam"]) if row["Diam"] else 6.0
        from astropy.coordinates import SkyCoord
        import astropy.units as units
        coordinate = SkyCoord(row["_RA.icrs"], row["_DE.icrs"], unit=(units.hourangle, units.deg), frame="icrs").galactic
        entries.append({
            "key": f"barnard-{number}", "designations": [f"Barnard {number}"],
            "l": round(float(coordinate.l.deg), 2), "b": round(float(coordinate.b.deg), 2),
            "radius_deg": diameter / 120, "area_deg2": math.pi * (diameter / 120) ** 2,
            "opacity_class": None, "catalog": "Barnard (1927)",
        })

    nebulae, sightlines, conflicts = [], {}, []
    for entry in entries:
        layers = contrast_layers(dust, entry["l"], entry["b"], entry["radius_deg"])
        embedded = not layers or max(layer["column"] for layer in layers) < CONTRAST_MIN
        if embedded:
            # A small nebula inside a larger cloud has no contrast at the map's resolution. It belongs to that
            # cloud when one dust layer holds most of the layered dust along it and a drawn cloud fills its outline there.
            pixels, weights = footprint_pixels(entry["l"], entry["b"], max(entry["radius_deg"], 0.05))
            density = (dust.mean[:, pixels] * weights).sum(1) * N_PER_E
            density[dust.centers > 1250] = 0
            layers = dust_layers(dust, density)
            if not layers:
                continue
        strongest = max(layer["column"] for layer in layers)
        layer = next(layer for layer in layers if layer["column"] >= 0.5 * strongest)
        # Share of the layered dust; the diffuse floor below the layer threshold spreads along every sightline.
        share = layer["column"] / sum(candidate["column"] for candidate in layers) if embedded else 1.0
        # Near the plane, dust beyond the map's 1.25 kpc can make a nebula, so a single dominant layer only
        # places nebulae at |b| >= 3 deg, where the map holds nearly all the dust along the sightline.
        if embedded and (share < 0.8 or abs(entry["b"]) < 3):
            continue
        direction = unit(entry["l"], entry["b"])
        cone = anchor_direction @ direction >= math.cos(math.radians(max(entry["radius_deg"], 0.3)))
        window = cone & (np.abs(anchor_distance - layer["distance"]) <= max(15.0, 0.15 * layer["distance"]))
        owners = np.bincount(anchor_owner[window], minlength=len(anchor_names))
        parent = anchor_names[int(owners.argmax())] if owners.max() > 0 else None
        distance, low, high = layer["distance"], layer["low"], layer["high"]
        method = {"distance_method": "edenhofer2024"}
        if parent and not anchor_own_map[window & (anchor_owner == anchor_names.index(parent))].any():
            # The layer is an Edenhofer copy of a drawn cloud the other map places elsewhere: use the drawn cloud.
            depths = anchor_distance[cone & (anchor_owner == anchor_names.index(parent)) & anchor_own_map]
            if len(depths):
                distance, low, high = (float(value) for value in np.percentile(depths, [50, 16, 84]))
                method = {"distance_method": "leike2020"}
        reach = max(entry["radius_deg"], 0.25)
        nearby = sorted((separation_deg(entry["l"], entry["b"], float(row["GLON"]), float(row["GLAT"])), index)
                        for index, row in enumerate(zucker))
        agreeing = [zucker[index] for separation, index in nearby
                    if separation <= reach and abs(float(zucker[index]["d50"]) - distance) <= 0.25 * distance]
        measured = [zucker[index] for separation, index in nearby if separation <= reach]
        if measured and not agreeing:
            # A direct measurement contradicts the map. Keep the nebula only where a drawn cloud fills it at the
            # measured distance, as for Corona Australis; otherwise which cloud the nebula is stays open.
            for row in measured:
                d50 = float(row["d50"])
                fill = cone & anchor_own_map & (np.abs(anchor_distance - d50) <= 0.25 * d50)
                if fill.any():
                    parent = anchor_names[int(np.bincount(anchor_owner[fill]).argmax())]
                    agreeing = [row]
                    break
            else:
                conflicts.append({"designations": entry["designations"], "map_distance_pc": round(distance, 1),
                                  "zucker": [[row["Name"], float(row["d50"])] for row in measured]})
                continue
        if agreeing:
            row = agreeing[0]
            distance, low, high = float(row["d50"]), float(row["d16"]), float(row["d84"])
            method = {"distance_method": "zucker2020", "zucker_cloud": row["Name"], "zucker_sightline": [float(row["GLON"]), float(row["GLAT"])]}
        if distance > SCOPE_PC:
            continue
        nebula = {
            **{key: value for key, value in entry.items() if key != "radius_deg"},
            "angular_diameter_arcmin": round(2 * entry["radius_deg"] * 60, 1),
            "distance_pc": round(distance, 1), "distance_range_pc": [round(low, 1), round(high, 1)],
            **({"embedded": True} if embedded else {"contrast_column_cm3_pc": round(layer["column"])}), **method,
            "parent_cloud": parent, "anchor_voxels": int(owners.max()),
        }
        if parent is None:
            nebula.update(own_geometry(dust, entry, low, high))
        nebulae.append(nebula)

    from astropy.coordinates import SkyCoord
    import astropy.units as units
    names = SkyCoord(l=[nebula["l"] for nebula in nebulae] * units.deg, b=[nebula["b"] for nebula in nebulae] * units.deg,
                     frame="galactic").get_constellation(short_name=False)
    for nebula, name in zip(nebulae, names):
        nebula["constellation"] = {"Boötes": "Bootes", "Chamaleon": "Chamaeleon", "Ophiucus": "Ophiuchus"}.get(str(name), str(name))

    # Zucker et al. (2020) sightlines that run through a cloud at their measured distance name it.
    for name in anchor_names:
        mine = (anchor_owner == anchor_names.index(name)) & anchor_own_map
        hits = []
        for row in zucker:
            direction = unit(float(row["GLON"]), float(row["GLAT"]))
            d50 = float(row["d50"])
            close = mine & (anchor_direction @ direction >= math.cos(math.radians(0.5))) & (np.abs(anchor_distance - d50) <= 0.25 * d50)
            if close.any():
                hits.append({"cloud": row["Name"], "sightline": [float(row["GLON"]), float(row["GLAT"])], "distance_pc": d50})
        if hits:
            sightlines[name] = hits
    return clouds, skipped, nebulae, sightlines, conflicts


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--measure", type=Path, required=True)
    arguments = parser.parse_args()
    clouds, skipped, nebulae, sightlines, conflicts = measure(arguments.measure)
    import numpy as np
    def frozen(cloud):
        order = np.lexsort(cloud["points"].T[::-1])
        return {**{key: value for key, value in cloud.items() if key not in ("points", "density")},
                "voxels_pc": cloud["points"][order].ravel().tolist()}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "schemaVersion": 1,
        "clouds": [frozen(cloud) for cloud in clouds],
        "skippedAsDrawn": skipped,
        "darkNebulae": nebulae,
        "zuckerSightlines": sightlines,
        "conflictingDistances": conflicts,
    }, separators=(",", ":")) + "\n")
    print(f"{len(clouds)} new clouds, {len(skipped)} skipped as already drawn, {len(nebulae)} dark nebulae within 1000 ly")


if __name__ == "__main__":
    main()
