"""Byte-level assertion for local prepared PNG evidence, NOT hosted GenLayer proof."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_png_evidence_manifest_exact_bytes():
    manifest = json.loads((ROOT / "provenance/media/png-evidence-manifest.json").read_text())
    assert manifest["status"] == "LOCAL_PREPARED_NOT_PUBLICLY_HOSTED"
    assert len(manifest["images"]) == 5
    for item in manifest["images"]:
        png = (ROOT / "apps/web/public/demo" / item["file"]).read_bytes()
        svg = (ROOT / "apps/web/public/demo" / item["source_svg"]).read_bytes()
        assert png.startswith(b"\x89PNG\r\n\x1a\n")
        assert item["media_type"] == "image/png"
        assert len(png) == item["byte_length"]
        assert hashlib.sha256(png).hexdigest() == item["sha256"]
        assert hashlib.sha256(svg).hexdigest() == item["source_svg_sha256"]
