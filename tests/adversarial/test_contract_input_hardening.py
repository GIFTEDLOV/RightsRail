"""Security regressions for exact authentication schema and public evidence URLs."""
from __future__ import annotations

import pytest

from tests.adversarial.test_unadjudicated_escrow_recovery import _load_with_shim


def _valid_auth(module):
    return {
        "schema_version": module.AUTH_SCHEMA,
        "evidence_id": "evidence-001",
        "request_id": "request-001",
        "policy_id": "policy-001",
        "policy_version": 1,
        "status": module.AUTH_AUTHENTICATED,
        "reference_sha256": "a" * 64,
        "reference_byte_length": 123,
        "proposed_sha256": "b" * 64,
        "proposed_byte_length": 456,
        "context_content_sha256": "",
        "context_screenshot_sha256": "",
    }


def test_authentication_rejects_boolean_numeric_fields(monkeypatch):
    module, _, _ = _load_with_shim(monkeypatch)
    for key in ("policy_version", "reference_byte_length", "proposed_byte_length"):
        invalid = _valid_auth(module)
        invalid[key] = True
        with pytest.raises(ValueError, match="authentication .* invalid"):
            module._parse_auth_result(invalid)
    assert module._parse_auth_result(_valid_auth(module))["policy_version"] == 1


def test_authentication_rejects_negative_and_overflow_lengths(monkeypatch):
    module, _, _ = _load_with_shim(monkeypatch)
    for length in (-1, 2**256):
        invalid = _valid_auth(module)
        invalid["reference_byte_length"] = length
        with pytest.raises(ValueError, match="authentication byte length is invalid"):
            module._parse_auth_result(invalid)


@pytest.mark.parametrize("source", [
    "http://example.com/file.png",
    "file:///etc/passwd",
    "ftp://example.com/image.png",
    "https://user:pass@example.com/image.png",
    "https://example.com/image.png#fragment",
    "https://example.com:443/image.png",
    "https://example.com/file.png\\\\path",
])
def test_media_source_rejects_non_public_or_ambiguous_urls(monkeypatch, source):
    module, _, _ = _load_with_shim(monkeypatch)
    with pytest.raises(ValueError, match="(HTTPS|unsafe|valid)"):
        module._require_url_or_source(source, "reference_source")


def test_media_source_accepts_public_https(monkeypatch):
    module, _, _ = _load_with_shim(monkeypatch)
    source = "https://rightsrail-evidence.vercel.app/reference.png"
    assert module._require_url_or_source(source, "reference_source") == source


def test_evidence_cannot_change_committed_asset_size_or_type(monkeypatch):
    module, _, contract = _load_with_shim(monkeypatch)
    policy = contract._policy("policy-001")
    policy.update(
        {"asset_sha256": "a" * 64, "asset_exact_bytes": 100, "asset_media_type": "image/png"}
    )
    contract._save(contract.policy_records, "policy-001", policy)
    request = contract._request("request-lost-001")
    request.update({
        "proposed_asset_sha256": "b" * 64,
        "proposed_asset_exact_bytes": 200,
        "proposed_media_type": "image/png",
        "attribution_text": "",
    })
    contract._save(contract.request_records, "request-lost-001", request)
    sources = {
        "reference_source": "https://rightsrail-evidence.vercel.app/reference.png",
        "proposed_source": "https://rightsrail-evidence.vercel.app/proposed.png",
        "public_context_url": "",
    }
    authority = module._hash_json(sources)
    base = dict(
        evidence_id="evidence-001", request_id="request-lost-001",
        reference_source=sources["reference_source"], reference_sha256="a" * 64,
        reference_byte_length=100, reference_mime="image/png",
        proposed_source=sources["proposed_source"], proposed_sha256="b" * 64,
        proposed_byte_length=200, proposed_mime="image/png",
        public_context_url="", context_content_sha256="",
        context_screenshot_sha256="", authority_digest=authority, attribution_text="",
    )
    for field, value, match in (
        ("reference_byte_length", 101, "reference length"),
        ("reference_mime", "image/jpeg", "reference length"),
        ("proposed_byte_length", 201, "proposed length"),
        ("proposed_mime", "image/jpeg", "proposed length"),
        ("context_screenshot_sha256", "c" * 64, "context digest"),
    ):
        bad = dict(base, **{field: value})
        with pytest.raises(ValueError, match=match):
            contract.commit_evidence(**bad)
    assert contract.evidence_records == {}
    contract.commit_evidence(**base)
    assert contract.get_evidence("evidence-001")["reference_byte_length"] == 100
