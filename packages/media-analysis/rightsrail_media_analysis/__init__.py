"""Bounded multimodal analysis boundary for two-image adjudication."""

MAX_IMAGES_PER_ADJUDICATION = 2


def validate_image_sources(reference_source: str, proposed_source: str) -> tuple[str, str]:
    if not reference_source.strip() or not proposed_source.strip():
        raise ValueError("both reference and proposed image sources are required")
    return reference_source, proposed_source
