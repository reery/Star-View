"""Filesystem guards for catalog authoring outputs."""

import os
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import BinaryIO, Iterator


def safe_output_directory(path: Path) -> Path:
    absolute = path.absolute()
    if absolute.is_symlink():
        raise ValueError(f"Output directory must not be a symbolic link: {path}")
    absolute.mkdir(parents=True, exist_ok=True)
    return absolute.resolve(strict=True)


def managed_path(directory: Path, name: str) -> Path:
    root = safe_output_directory(directory)
    target = root / name
    if target.is_symlink():
        raise ValueError(f"Managed output must not be a symbolic link: {name}")
    return target


@contextmanager
def atomic_binary_writer(path: Path) -> Iterator[BinaryIO]:
    target = managed_path(path.parent, path.name)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{target.name}.", dir=target.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as output:
            yield output
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_write_text(path: Path, content: str) -> None:
    with atomic_binary_writer(path) as output:
        output.write(content.encode("utf-8"))


def write_managed_files(directory: Path, files: dict[str, bytes | str], force: bool = False) -> None:
    root = safe_output_directory(directory)
    targets = {name: managed_path(root, name) for name in files}
    if not force and any(target.exists() for target in targets.values()):
        raise FileExistsError("Output exists; use --force for an intentional regeneration")
    staging = Path(tempfile.mkdtemp(prefix=".catalog-staging-", dir=root))
    backup = Path(tempfile.mkdtemp(prefix=".catalog-backup-", dir=root))
    installed: list[str] = []
    backed_up: list[str] = []
    preserve_backup = False
    try:
        for name, content in files.items():
            data = content.encode("utf-8") if isinstance(content, str) else content
            target = staging / name
            with target.open("xb") as output:
                output.write(data)
                output.flush()
                os.fsync(output.fileno())
            if target.read_bytes() != data:
                raise OSError(f"Failed to verify staged output: {name}")
        try:
            for name, target in targets.items():
                if target.exists():
                    os.replace(target, backup / name)
                    backed_up.append(name)
            for name, target in targets.items():
                os.replace(staging / name, target)
                installed.append(name)
        except BaseException as publish_error:
            for name in installed:
                targets[name].unlink(missing_ok=True)
            try:
                for name in backed_up:
                    os.replace(backup / name, targets[name])
            except BaseException as restore_error:
                preserve_backup = True
                raise ExceptionGroup(
                    f"Failed to publish and restore catalog package; backup preserved at {backup}",
                    [publish_error, restore_error],
                )
            raise
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        if not preserve_backup:
            shutil.rmtree(backup, ignore_errors=True)