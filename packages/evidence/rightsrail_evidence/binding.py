"""Small, immutable evidence-binding helpers; media blobs remain off-chain."""

from __future__ import annotations

from dataclasses import dataclass
import re

from rightsrail_shared import canonical_digest

_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def validate_sha256(value: str, field_name: str = "sha256") -> str:
    if not isinstance(value, str) or not _SHA256.fullmatch(value):
        raise ValueError(f"{field_name} must be a lowercase SHA-256 hex digest")
    return value


@dataclass(frozen=True)
class EvidenceBinding:
    reference_asset_sha256: str
    proposed_asset_sha256: str
    content_sha256: str
    exact_byte_length: int
    media_type: str
    source_identifier: str
    authority_identifier: str
    request_id: str
    policy_id: str
    policy_version: int

    def __post_init__(self) -> None:
        validate_sha256(self.reference_asset_sha256, "reference_asset_sha256")
        validate_sha256(self.proposed_asset_sha256, "proposed_asset_sha256")
        validate_sha256(self.content_sha256, "content_sha256")
        if type(self.exact_byte_length) is not int or self.exact_byte_length < 0:
            raise ValueError("exact_byte_length must be a non-negative integer")
        if not isinstance(self.media_type, str) or not self.media_type.strip():
            raise ValueError("media_type must be non-empty")
        if self.policy_version < 1:
            raise ValueError("policy_version must be positive")
        for name, value in (
            ("source_identifier", self.source_identifier),
            ("authority_identifier", self.authority_identifier),
            ("request_id", self.request_id),
            ("policy_id", self.policy_id),
        ):
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{name} must be non-empty")

    @property
    def source_digest(self) -> str:
        return canonical_digest(self.source_identifier)

    @property
    def authority_digest(self) -> str:
        return canonical_digest(self.authority_identifier)
