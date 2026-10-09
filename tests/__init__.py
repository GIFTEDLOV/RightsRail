"""Test bootstrap for the intentionally uninstalled monorepo packages."""

from pathlib import Path
import sys

_ROOT = Path(__file__).resolve().parent.parent
for _package_root in (_ROOT / "packages").glob("*"):
    if _package_root.is_dir():
        sys.path.insert(0, str(_package_root))
