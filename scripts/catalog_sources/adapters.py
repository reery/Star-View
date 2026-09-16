"""Adapters from frozen structured exports to normalized observations."""

import csv
import json
from pathlib import Path
from typing import Iterator

from .models import AstrometryObservation, IdentityRecord, NormalizedSourceRecord, PhysicalObservation


def _text(value: str | None) -> str | None:
    stripped = (value or "").strip()
    return stripped if stripped and stripped not in {"-", "--"} else None


def _number(value: str | None) -> float | None:
    text = _text(value)
    return float(text) if text is not None else None


def _required_number(value: str | None, label: str) -> float:
    number = _number(value)
    if number is None:
        raise ValueError(f"Missing required {label}")
    return number


def _csv_rows(path: Path) -> Iterator[dict[str, str]]:
    with path.open(newline="") as source:
        yield from csv.DictReader(source)


def read_cns5(path: Path) -> list[NormalizedSourceRecord]:
    records = []
    for line_number, line in enumerate(path.read_text().splitlines(), 1):
        if len(line) < 761:
            raise ValueError(f"CNS5 line {line_number} has {len(line)} bytes; expected 761")
        value = lambda start, end: _text(line[start - 1:end])
        cns5_id = value(1, 4)
        if cns5_id is None:
            raise ValueError(f"CNS5 line {line_number} has no identifier")
        gaia_id = value(28, 46)
        aliases = tuple(alias for alias in (f"GJ {value(6, 11)}" if value(6, 11) else None, f"HIP {value(48, 53)}" if value(48, 53) else None) if alias)
        identity = IdentityRecord(
            source_id="cns5",
            source_record_id=cns5_id,
            gaia_dr3_id=gaia_id,
            aliases=aliases,
            component=value(13, 16),
            system_role="primary" if value(20, 20) == "1" else "component" if value(18, 18) else None,
        )
        required = [value(55, 74), value(76, 98), value(100, 108), value(130, 148), value(184, 206), value(230, 252)]
        astrometry = None
        if any(item is not None for item in required):
            if not all(item is not None for item in required):
                raise ValueError(f"CNS5 {cns5_id} has an incomplete astrometry group")
            radial_velocity = _number(value(297, 319))
            astrometry = AstrometryObservation(
                source_id="cns5",
                source_record_id=cns5_id,
                ra_deg=_required_number(required[0], "RA"),
                dec_deg=_required_number(required[1], "Dec"),
                epoch=_required_number(required[2], "epoch"),
                parallax_mas=_required_number(required[3], "parallax"),
                pm_ra_cosdec_masyr=_required_number(required[4], "pmRA"),
                pm_dec_masyr=_required_number(required[5], "pmDec"),
                parallax_error_mas=_number(value(150, 162)),
                pm_ra_error_masyr=_number(value(208, 228)),
                pm_dec_error_masyr=_number(value(254, 275)),
                radial_velocity_kms=radial_velocity,
                radial_velocity_error_kms=_number(value(321, 340)) if radial_velocity is not None else None,
                astrometry_ref="; ".join(dict.fromkeys(filter(None, (value(110, 128), value(164, 182), value(277, 295))))),
                radial_velocity_ref=value(342, 360) if radial_velocity is not None else None,
            )
        records.append(NormalizedSourceRecord(identity=identity, astrometry=astrometry, raw={"line": line_number}))
    return records


def read_gaia_tap(path: Path) -> list[NormalizedSourceRecord]:
    records = []
    for row in _csv_rows(path):
        source_id = _text(row.get("source_id"))
        if source_id is None:
            raise ValueError("Gaia row has no source_id")
        motion = tuple(_number(row.get(field)) for field in ("parallax", "pmra", "pmdec"))
        if any(value is not None for value in motion) and not all(value is not None for value in motion):
            raise ValueError(f"Gaia {source_id} has an incomplete astrometry group")
        radial_velocity = _number(row.get("radial_velocity"))
        astrometry = AstrometryObservation(
            source_id="gaia-dr3",
            source_record_id=source_id,
            ra_deg=_required_number(row.get("ra"), "RA"),
            dec_deg=_required_number(row.get("dec"), "Dec"),
            epoch=_number(row.get("ref_epoch")) or 2016.0,
            parallax_mas=motion[0],
            pm_ra_cosdec_masyr=motion[1],
            pm_dec_masyr=motion[2],
            parallax_error_mas=_number(row.get("parallax_error")),
            pm_ra_error_masyr=_number(row.get("pmra_error")),
            pm_dec_error_masyr=_number(row.get("pmdec_error")),
            radial_velocity_kms=radial_velocity,
            radial_velocity_error_kms=_number(row.get("radial_velocity_error")) if radial_velocity is not None else None,
            astrometry_ref="Gaia DR3",
            radial_velocity_ref="Gaia DR3" if radial_velocity is not None else None,
            quality_flags=tuple(flag for flag in ("duplicated-source" if row.get("duplicated_source", "").lower() == "true" else None,) if flag),
        ) if all(value is not None for value in motion) else None
        physical = []
        flame_flags = tuple(filter(None, (_text(row.get("flags_flame")),)))
        for field, column, lower, upper, flags in (
            ("temperature_k", "teff_gspphot", "teff_gspphot_lower", "teff_gspphot_upper", ()),
            ("mass_solar", "mass_flame", "mass_flame_lower", "mass_flame_upper", flame_flags),
            ("luminosity_solar", "lum_flame", "lum_flame_lower", "lum_flame_upper", flame_flags),
        ):
            value = _number(row.get(column))
            if value is not None:
                lower_value = _number(row.get(lower))
                upper_value = _number(row.get(upper))
                uncertainty = max(value - lower_value, upper_value - value) if lower_value is not None and upper_value is not None else None
                physical.append(PhysicalObservation("gaia-dr3", source_id, field, value, uncertainty, "model-derived", "Gaia DR3 astrophysical_parameters", flags))
        records.append(NormalizedSourceRecord(IdentityRecord("gaia-dr3", source_id, gaia_dr3_id=source_id), astrometry, tuple(physical), row))
    return records


def read_simbad_tap(path: Path) -> list[NormalizedSourceRecord]:
    records = []
    for row in _csv_rows(path):
        main_id = _text(row.get("main_id"))
        if main_id is None:
            raise ValueError("SIMBAD row has no main_id")
        aliases = tuple(sorted(set(filter(None, (_text(value) for value in ((row.get("query_id") or "") + "|" + (row.get("ids") or "")).split("|"))))))
        gaia = next((alias.removeprefix("Gaia DR3 ") for alias in aliases if alias.startswith("Gaia DR3 ")), None)
        records.append(NormalizedSourceRecord(IdentityRecord("simbad", main_id, gaia_dr3_id=gaia, simbad_id=main_id, aliases=aliases), raw=row))
    return records


def read_cifuentes(path: Path) -> list[NormalizedSourceRecord]:
    records = []
    for row in _csv_rows(path):
        identifier = _text(row.get("GaiaDR3") or row.get("gaia_dr3_id") or row.get("Name"))
        if identifier is None:
            raise ValueError("Cifuentes row has no usable identifier")
        physical = []
        for field, names in (("temperature_k", ("Teff", "temperature_k")), ("mass_solar", ("Mass", "mass_solar")), ("luminosity_solar", ("Lum", "luminosity_solar"))):
            value = next((_number(row.get(name)) for name in names if _number(row.get(name)) is not None), None)
            if value is not None:
                physical.append(PhysicalObservation("cifuentes-2020", identifier, field, value, None, "model-derived", "2020A&A...642A.115C"))
        records.append(NormalizedSourceRecord(IdentityRecord("cifuentes-2020", identifier, gaia_dr3_id=identifier if identifier.isdigit() else None, aliases=(identifier,)), physical=tuple(physical), raw=row))
    return records


def read_primary_overrides(path: Path) -> list[NormalizedSourceRecord]:
    payload = json.loads(path.read_text())
    records = []
    for row in payload["records"]:
        identifier = str(row["starViewId"])
        observations = tuple(PhysicalObservation("primary-paper", identifier, item["field"], float(item["value"]), float(item["uncertainty"]) if item.get("uncertainty") is not None else None, item.get("status", "measured"), item["reference"], tuple(item.get("qualityFlags", ()))) for item in row.get("physical", ()))
        records.append(NormalizedSourceRecord(IdentityRecord("primary-paper", identifier, star_view_id=identifier, gaia_dr3_id=str(row["gaiaDr3Id"]) if row.get("gaiaDr3Id") is not None else None), physical=observations, raw=row))
    return records