"""M-dwarf physical-property supplements: Cifuentes et al. 2020 and Mann et al. 2015/2019."""

import csv
import io
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from .adapters import read_cifuentes, read_cns5, read_simbad_tap, read_twomass_psc
from .models import NormalizedSourceRecord, PhysicalObservation
from .resolution import resolve_physical_field
from .snapshots import sha256, verify_sha256

MANN2019_REFERENCE = "2019ApJ...871...63M"
MANN2015_REFERENCE = "2015ApJ...804...64M"
# Mann et al. 2019 Table 6, n=5 fit without [Fe/H]: log10(M) = sum a_i (M_Ks - 7.5)^i.
MANN2019_COEFFICIENTS = (-0.642, -0.208, -8.43e-4, 7.87e-3, 1.42e-4, -2.13e-4)
MANN2019_ZERO_POINT = 7.5
MANN2019_FRACTIONAL_SCATTER = 0.020
MANN2019_RANGE = (4.0, 11.0)
# Mann et al. 2015 Table 1, Eq. 4: R = a + b M_Ks + c M_Ks^2.
MANN2015_COEFFICIENTS = (1.9515, -0.3520, 0.01680)
MANN2015_FRACTIONAL_SCATTER = 0.0289
MANN2015_RANGE = (4.6, 9.8)
# Spectral subclass numbers: K5 = -5, K7 = -3, M0 = 0, M9.5 = 9.5.
SUPPLEMENT_SPECTRAL_RANGE = (-5.0, 9.5)
MANN2015_SPECTRAL_RANGE = (-3.0, 7.0)
BLEND_RADIUS_ARCSEC = 5.0
DISTANCE_TOLERANCE = 0.05
BLEND_EPOCH = 2016.0
SUPPLEMENT_FIELDS = ("temperature_k", "mass_solar", "luminosity_solar", "radius_solar")
CROSSMATCH_HEADERS = ["star_view_id", "cns5_id", "simbad_id", "twomass", "karmn", "gaia_dr2", "identity_method"]
SOURCE_LABELS = {
    "cifuentes-2020": "Cifuentes et al. 2020 CARMENES SED analysis (2020A&A...642A.115C)",
    "mann-2019": "Mann et al. 2019 absolute-Ks mass relation with 2MASS Ks (2019ApJ...871...63M)",
    "mann-2015": "Mann et al. 2015 absolute-Ks radius relation with 2MASS Ks (2015ApJ...804...64M)",
}
FIELD_LABELS = {"temperature_k": "temperature", "mass_solar": "mass", "luminosity_solar": "luminosity", "radius_solar": "radius"}
SPECTRAL_PATTERN = re.compile(r"d?([KM])(\d(?:\.\d+)?)((?:/\d(?:\.\d+)?)?[+-]?V?(?:e|k|n|\(e\)|\(k\)|:)*)")


def dwarf_subclass(spectral_type: str | None) -> float | None:
    """K/M dwarf subclass number, or None for giants, subdwarfs, composites and peculiar types."""
    match = SPECTRAL_PATTERN.fullmatch((spectral_type or "").strip())
    if match is None:
        return None
    subtype = float(match[2])
    return subtype - 10 if match[1] == "K" else subtype


def absolute_ks_sigma(ks_error: float, parallax_fraction_error: float | None) -> float:
    return math.hypot(ks_error, 5 / math.log(10) * (parallax_fraction_error or 0.0))


def mann2019_mass(absolute_ks: float, absolute_ks_error: float = 0.0) -> tuple[float, float]:
    offset = absolute_ks - MANN2019_ZERO_POINT
    log_mass = sum(coefficient * offset ** power for power, coefficient in enumerate(MANN2019_COEFFICIENTS))
    slope = sum(power * coefficient * offset ** (power - 1) for power, coefficient in enumerate(MANN2019_COEFFICIENTS) if power)
    mass = 10 ** log_mass
    return mass, mass * math.hypot(MANN2019_FRACTIONAL_SCATTER, math.log(10) * slope * absolute_ks_error)


def mann2015_radius(absolute_ks: float, absolute_ks_error: float = 0.0) -> tuple[float, float]:
    a, b, c = MANN2015_COEFFICIENTS
    radius = a + b * absolute_ks + c * absolute_ks ** 2
    return radius, math.hypot(MANN2015_FRACTIONAL_SCATTER * radius, (b + 2 * c * absolute_ks) * absolute_ks_error)


def _unique_alias(aliases: tuple[str, ...], prefix: str) -> str:
    values = {alias.removeprefix(prefix).strip() for alias in aliases if alias.startswith(prefix)}
    return values.pop() if len(values) == 1 else ""


def _cns5_buffer(root: Path) -> list[NormalizedSourceRecord]:
    frozen = root / "catalog-work/nearest-1000"
    size = json.loads((frozen / "source-manifest.json").read_text())["bufferSize"]
    records = [record for record in read_cns5(frozen / "cns5.dat") if record.astrometry is not None]
    records.sort(key=lambda record: (-record.astrometry.parallax_mas, record.identity.source_record_id))
    return records[:size]


def build_crossmatch(root: Path) -> str:
    """Exact-identifier crossmatch from frozen nearest-1000 SIMBAD and nearest-100 10pc identities."""
    simbad = {}
    for record in read_simbad_tap(root / "catalog-work/nearest-1000/simbad.csv"):
        simbad[(record.raw or {})["query_id"].removeprefix("CNS5 ")] = record
    nearest100 = list(csv.DictReader(io.StringIO((root / "src/data/catalogs/nearest-100/stars.csv").read_text())))
    provenance = {item["id"]: item for item in json.loads((root / "src/data/catalogs/nearest-100/provenance.json").read_text())["objects"]}
    matches = json.loads((root / "catalog-work/nearest-100/source-input.json").read_text())["cns5Matches"]
    cns5_by_sequence = {sequence: match["cns5"] for match in matches for sequence in match["sequences"]}
    ids_by_cns5: dict[str, list[str]] = {}
    for row in nearest100:
        if row["id"] != "sun":
            cns5_id = cns5_by_sequence.get(provenance[row["id"]]["sourceRow"])
            if cns5_id:
                ids_by_cns5.setdefault(cns5_id, []).append(row["id"])

    def simbad_identity(star_view_id: str, cns5_id: str, method: str, fallback_dr2: str = "") -> dict[str, str]:
        record = simbad[cns5_id]
        aliases = record.identity.aliases
        return {
            "star_view_id": star_view_id, "cns5_id": cns5_id, "simbad_id": record.identity.simbad_id or "",
            "twomass": _unique_alias(aliases, "2MASS J"), "karmn": _unique_alias(aliases, "Karmn "),
            "gaia_dr2": _unique_alias(aliases, "Gaia DR2 ") or fallback_dr2, "identity_method": method,
        }

    rows = []
    for row in nearest100:
        if row["id"] == "sun":
            continue
        cns5_id = cns5_by_sequence.get(provenance[row["id"]]["sourceRow"])
        tenpc_dr2 = provenance[row["id"]]["identifiers"].get("GaiaDR2") or ""
        if cns5_id and len(ids_by_cns5[cns5_id]) == 1 and cns5_id in simbad:
            rows.append(simbad_identity(row["id"], cns5_id, "nearest-100 source row; frozen CNS5 match; exact SIMBAD CNS5 identity", tenpc_dr2))
        else:
            rows.append({"star_view_id": row["id"], "cns5_id": "", "simbad_id": "", "twomass": "", "karmn": "", "gaia_dr2": tenpc_dr2, "identity_method": "10pc Gaia DR2 identifier only; CNS5 identity shared by several components or absent"})
    for record in _cns5_buffer(root):
        cns5_id = record.identity.source_record_id
        if cns5_id not in ids_by_cns5 and cns5_id in simbad:
            rows.append(simbad_identity(f"cns5-{int(cns5_id):04d}", cns5_id, "exact SIMBAD CNS5 identity"))
    rows.sort(key=lambda item: item["star_view_id"])
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=CROSSMATCH_HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


def blended_cns5_ids(cns5_path: Path, targets: set[str], radius_arcsec: float = BLEND_RADIUS_ARCSEC) -> set[str]:
    """CNS5 targets with another CNS5 object inside the radius after linear propagation to one epoch."""
    records = [record for record in read_cns5(cns5_path) if record.astrometry is not None]
    identifiers = [record.identity.source_record_id for record in records]
    astrometry = [record.astrometry for record in records]
    dt = np.array([BLEND_EPOCH - item.epoch for item in astrometry])
    dec = np.radians(np.array([item.dec_deg for item in astrometry]) + np.array([item.pm_dec_masyr for item in astrometry]) * dt / 3.6e6)
    ra = np.radians(np.array([item.ra_deg for item in astrometry]) + np.array([item.pm_ra_cosdec_masyr for item in astrometry]) * dt / 3.6e6 / np.cos(dec))
    vectors = np.stack([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], axis=1)
    threshold = math.cos(math.radians(radius_arcsec / 3600))
    blended = set()
    for index, identifier in enumerate(identifiers):
        if identifier in targets:
            close = vectors @ vectors[index] >= threshold
            close[index] = False
            if close.any():
                blended.add(identifier)
    return blended


@dataclass(frozen=True)
class RowContext:
    star_view_id: str
    object_type: str
    spectral_type: str
    distance_pc: float
    parallax_fraction_error: float | None


@dataclass
class Supplements:
    crossmatch: dict[str, dict[str, str]]
    cifuentes_by_karmn: dict[str, NormalizedSourceRecord]
    cifuentes_by_dr2: dict[str, NormalizedSourceRecord | None]
    twomass: dict[str, dict[str, Any]]
    blended: set[str]
    manifest_sha256: str
    cifuentes_claims: dict[str, int]
    twomass_claims: dict[str, int]

    def cifuentes_candidates(self, entry: dict[str, str]) -> dict[str, tuple[NormalizedSourceRecord, str]]:
        candidates = {}
        if entry["gaia_dr2"] and self.cifuentes_by_dr2.get(entry["gaia_dr2"]):
            record = self.cifuentes_by_dr2[entry["gaia_dr2"]]
            candidates[record.identity.source_record_id] = (record, "Gaia DR2")
        if entry["karmn"] and entry["karmn"] in self.cifuentes_by_karmn:
            record = self.cifuentes_by_karmn[entry["karmn"]]
            candidates[record.identity.source_record_id] = (record, "Karmn")
        return candidates


def load_supplements(folder: Path, cns5_path: Path) -> Supplements:
    manifest = json.loads((folder / "source-manifest.json").read_text())
    for name, digest in manifest["checksumsSha256"].items():
        verify_sha256(folder / name, digest)
    crossmatch = {row["star_view_id"]: row for row in csv.DictReader(io.StringIO((folder / "crossmatch.csv").read_text()))}
    cifuentes = read_cifuentes(folder / "cifuentes2020-tablea3.dat")
    by_karmn = {record.identity.source_record_id: record for record in cifuentes}
    if len(by_karmn) != len(cifuentes):
        raise ValueError("Cifuentes Karmn identifiers are not unique")
    by_dr2: dict[str, NormalizedSourceRecord | None] = {}
    for record in cifuentes:
        dr2 = (record.raw or {}).get("gaiaDr2Primary")
        if dr2:
            by_dr2[dr2] = None if dr2 in by_dr2 else record
    supplements = Supplements(
        crossmatch, by_karmn, by_dr2, read_twomass_psc(folder / "twomass.csv"),
        blended_cns5_ids(cns5_path, {row["cns5_id"] for row in crossmatch.values() if row["cns5_id"]}),
        sha256(folder / "source-manifest.json"), {}, {},
    )
    for entry in crossmatch.values():
        for karmn in supplements.cifuentes_candidates(entry):
            supplements.cifuentes_claims[karmn] = supplements.cifuentes_claims.get(karmn, 0) + 1
        if entry["twomass"]:
            supplements.twomass_claims[entry["twomass"]] = supplements.twomass_claims.get(entry["twomass"], 0) + 1
    return supplements


def supplement_observations(context: RowContext, supplements: Supplements) -> tuple[list[PhysicalObservation], dict[str, Any] | None]:
    entry = supplements.crossmatch.get(context.star_view_id)
    if entry is None:
        return [], None
    audit: dict[str, Any] = {"identity": {key: value for key, value in entry.items() if key != "star_view_id" and value}}
    subclass = dwarf_subclass(context.spectral_type)
    if context.object_type not in {"star", "brown_dwarf"} or subclass is None or not SUPPLEMENT_SPECTRAL_RANGE[0] <= subclass <= SUPPLEMENT_SPECTRAL_RANGE[1]:
        audit["eligibility"] = "Not a parsed K5-M9.5 dwarf spectral type (no subdwarf, giant, composite or peculiar class); supplements not applied."
        return [], audit
    observations: list[PhysicalObservation] = []
    cifuentes_flags = set()
    candidates = supplements.cifuentes_candidates(entry)
    cifuentes_audit: dict[str, Any] = {"status": "no exact identifier match"}
    if len(candidates) > 1:
        cifuentes_audit = {"status": "withheld", "records": sorted(candidates), "reasons": ["Karmn and Gaia DR2 identify different Cifuentes rows"]}
    elif candidates:
        record, method = next(iter(candidates.values()))
        raw = record.raw or {}
        cifuentes_flags = {flag for flag in ("multiple", "young", "ruwe") if raw.get(flag)}
        reasons = []
        if supplements.cifuentes_claims[record.identity.source_record_id] > 1:
            reasons.append("Cifuentes row is claimed by several Star View objects")
        if raw.get("multiple"):
            reasons.append("Cifuentes close multiple (<5 arcsec)")
        if raw.get("ruwe"):
            reasons.append("Gaia DR2 RUWE>1.41 flag; possible unresolved binary")
        distance_ratio = raw["distancePc"] / context.distance_pc - 1
        if abs(distance_ratio) > DISTANCE_TOLERANCE:
            reasons.append(f"Cifuentes distance {raw['distancePc']} pc differs by {100 * distance_ratio:+.1f}% from adopted distance")
        adopted = [] if reasons else [item for item in record.physical if item.field != "mass_solar" or not raw.get("young")]
        if raw.get("young") and not reasons:
            reasons.append("Overluminous young flag; Schweitzer et al. 2019 mass-radius relation not applied")
        observations.extend(adopted)
        cifuentes_audit = {"record": record.identity.source_record_id, "matchedBy": method, "distancePc": raw["distancePc"], "status": "adopted" if adopted else "withheld", "fields": [item.field for item in adopted], "reasons": reasons}
    audit["cifuentes2020"] = cifuentes_audit
    audit["mann"] = _mann_observations(context, supplements, entry, subclass, cifuentes_flags, observations)
    return observations, audit


def _mann_observations(context: RowContext, supplements: Supplements, entry: dict[str, str], subclass: float, cifuentes_flags: set[str], observations: list[PhysicalObservation]) -> dict[str, Any]:
    designation = entry["twomass"]
    photometry = supplements.twomass.get(designation) if designation else None
    reason = None
    if not designation:
        reason = "No unique 2MASS identifier"
    elif photometry is None:
        reason = "2MASS designation absent from the frozen PSC export"
    elif supplements.twomass_claims[designation] > 1:
        reason = "2MASS source is claimed by several Star View objects"
    elif not entry["cns5_id"] or entry["cns5_id"] in supplements.blended:
        reason = f"Another CNS5 object lies within {BLEND_RADIUS_ARCSEC:g} arcsec; Ks may be blended"
    elif cifuentes_flags:
        reason = "Cifuentes flags " + ", ".join(sorted(cifuentes_flags)) + "; single main-sequence relation not applied"
    elif len(photometry["quality_flags"]) != 3 or photometry["quality_flags"][2] not in "AB" or photometry["blend_flags"][2:3] != "1" or photometry["contamination_flags"][2:3] != "0":
        reason = "2MASS Ks quality, blend or contamination flag not clean (requires Q=A/B, B=1, C=0)"
    elif photometry["ks_mag"] is None or photometry["ks_error_mag"] is None:
        reason = "2MASS Ks or its uncertainty is missing"
    if reason:
        return {"twomass": designation or None, "status": "withheld", "reasons": [reason]}
    absolute_ks = photometry["ks_mag"] - 5 * math.log10(context.distance_pc / 10)
    sigma = absolute_ks_sigma(photometry["ks_error_mag"], context.parallax_fraction_error)
    flags = (f"2MASS Q={photometry['quality_flags']} B={photometry['blend_flags']} C={photometry['contamination_flags']}", f"MKs={absolute_ks:.4f}+/-{sigma:.4f}")
    audit: dict[str, Any] = {"twomass": designation, "ksMag": photometry["ks_mag"], "ksErrorMag": photometry["ks_error_mag"], "absoluteKs": round(absolute_ks, 4), "absoluteKsError": round(sigma, 4), "fields": [], "reasons": []}
    if MANN2019_RANGE[0] <= absolute_ks <= MANN2019_RANGE[1]:
        mass, error = mann2019_mass(absolute_ks, sigma)
        observations.append(PhysicalObservation("mann-2019", designation, "mass_solar", round(mass, 4), round(error, 4), "empirical-relation", MANN2019_REFERENCE, flags))
        audit["fields"].append("mass_solar")
    else:
        audit["reasons"].append(f"M_Ks outside Mann 2019 range {MANN2019_RANGE[0]:g}-{MANN2019_RANGE[1]:g}")
    if not MANN2015_SPECTRAL_RANGE[0] <= subclass <= MANN2015_SPECTRAL_RANGE[1]:
        audit["reasons"].append("Spectral type outside Mann 2015 K7-M7 calibration")
    elif not MANN2015_RANGE[0] <= absolute_ks <= MANN2015_RANGE[1]:
        audit["reasons"].append(f"M_Ks outside Mann 2015 range {MANN2015_RANGE[0]:g}-{MANN2015_RANGE[1]:g}")
    else:
        radius, error = mann2015_radius(absolute_ks, sigma)
        observations.append(PhysicalObservation("mann-2015", designation, "radius_solar", round(radius, 4), round(error, 4), "empirical-relation", MANN2015_REFERENCE, flags))
        audit["fields"].append("radius_solar")
    audit["status"] = "adopted" if audit["fields"] else "withheld"
    return audit


def format_value(observation: PhysicalObservation) -> str:
    return str(round(observation.value)) if observation.field == "temperature_k" else str(observation.value)


def supplement_note(adopted: dict[str, PhysicalObservation]) -> str:
    groups: dict[str, list[str]] = {}
    for field in SUPPLEMENT_FIELDS:
        if field in adopted:
            groups.setdefault(adopted[field].source_id, []).append(FIELD_LABELS[field])
    return "Supplementary " + "; ".join(f"{', '.join(labels)} from {SOURCE_LABELS[source]}" for source, labels in groups.items()) + "."


def resolve_supplemented_fields(row: dict[str, str], observations: list[PhysicalObservation], replaceable: dict[str, PhysicalObservation] | None = None) -> dict[str, PhysicalObservation]:
    """Fill blank fields (or fields held by `replaceable` lower-tier observations); never touch curated values."""
    replaceable = replaceable or {}
    adopted = {}
    for field in SUPPLEMENT_FIELDS:
        current = replaceable.get(field)
        if row.get(field, "") != "" and current is None:
            continue
        selected, _ = resolve_physical_field(field, observations + ([current] if current else []))
        if selected is not None and selected is not current:
            row[field] = format_value(selected)
            adopted[field] = selected
    if adopted:
        row["notes"] = (row["notes"] + " " + supplement_note(adopted)).strip()
    return adopted


def row_context(row: dict[str, str]) -> RowContext:
    distance = math.sqrt(sum(float(row[key]) ** 2 for key in ("x_pc", "y_pc", "z_pc")))
    parallax, error = row.get("parallax_mas", ""), row.get("parallax_error_mas", "")
    fraction = float(error) / float(parallax) if parallax and error else None
    return RowContext(row["id"], row["type"], row["spectral_type"], distance, fraction)


def enrich_curated_row(
    row: dict[str, str],
    supplements: Supplements,
    replaceable: dict[str, PhysicalObservation] | None = None,
) -> tuple[dict[str, PhysicalObservation], dict[str, Any] | None]:
    if row["id"] == "sun":
        return {}, None
    observations, audit = supplement_observations(row_context(row), supplements)
    return resolve_supplemented_fields(row, observations, replaceable), audit
