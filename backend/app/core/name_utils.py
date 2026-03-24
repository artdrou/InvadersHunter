import re

# Expected format after normalization: CITYCODE_NUMBER
# e.g. PA_10, LYO_3, NY_42
_NAME_PATTERN = re.compile(r"^[A-Z]{2,6}_\d+$")


def normalize_name(name: str) -> str:
    """
    Normalize an invader name to the canonical CITYCODE_NUMBER format.

    Rules:
    - Strip surrounding whitespace
    - Uppercase
    - Replace any run of non-alphanumeric characters with a single underscore
    - Collapse multiple underscores into one
    - Strip leading/trailing underscores

    Examples:
        "pa_10"   -> "PA_10"
        "PA 10"   -> "PA_10"
        "pa - 10" -> "PA_10"
        "PA__10"  -> "PA_10"
    """
    s = name.strip().upper()
    s = re.sub(r"[^A-Z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s)
    s = s.strip("_")
    return s


def validate_name_format(normalized: str) -> bool:
    """Return True if the normalized name matches CITYCODE_NUMBER."""
    return bool(_NAME_PATTERN.match(normalized))


def names_are_similar(a: str, b: str) -> bool:
    """
    Return True if two raw names refer to the same invader.
    Comparison is done on their normalized forms.
    """
    return normalize_name(a) == normalize_name(b)
