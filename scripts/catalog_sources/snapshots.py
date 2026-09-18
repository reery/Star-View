"""Deterministic frozen-source file helpers."""

import hashlib
import json
from pathlib import Path
from typing import Any

from .filesystem import atomic_write_text


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sha256(path: Path, expected: str) -> None:
    actual = sha256(path)
    if actual != expected:
        raise ValueError(f"Checksum drift for {path.name}: expected {expected}, received {actual}")


def canonical_json(value: Any) -> str:
    return json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True, allow_nan=False) + "\n"


def write_canonical_json(path: Path, value: Any) -> None:
    atomic_write_text(path, canonical_json(value))