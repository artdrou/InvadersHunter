"""Tests for name normalization and validation utilities."""
from app.core.name_utils import normalize_name, validate_name_format, names_are_similar


# ── normalize_name ─────────────────────────────────────────────────────────────

def test_normalize_lowercase():
    assert normalize_name("pa_10") == "PA_10"

def test_normalize_space_separator():
    assert normalize_name("PA 10") == "PA_10"

def test_normalize_dash_separator():
    assert normalize_name("pa - 10") == "PA_10"

def test_normalize_double_underscore():
    assert normalize_name("PA__10") == "PA_10"

def test_normalize_strips_surrounding_whitespace():
    assert normalize_name("  pa_10  ") == "PA_10"

def test_normalize_multiple_dashes():
    assert normalize_name("pa---10") == "PA_10"

def test_normalize_mixed_separators():
    assert normalize_name("PA - 10") == "PA_10"

def test_normalize_already_canonical():
    assert normalize_name("PA_10") == "PA_10"

def test_normalize_three_char_city():
    assert normalize_name("lyo_3") == "LYO_3"


# ── validate_name_format ───────────────────────────────────────────────────────

def test_validate_standard_name():
    assert validate_name_format("PA_10") is True

def test_validate_two_char_city():
    assert validate_name_format("PA_10") is True

def test_validate_six_char_city():
    assert validate_name_format("ABCDEF_99") is True

def test_validate_city_one_char_fails():
    assert validate_name_format("P_10") is False

def test_validate_city_seven_chars_fails():
    assert validate_name_format("ABCDEFG_10") is False

def test_validate_no_underscore_fails():
    assert validate_name_format("PA10") is False

def test_validate_no_number_fails():
    assert validate_name_format("PA_") is False

def test_validate_lowercase_fails():
    assert validate_name_format("pa_10") is False

def test_validate_number_before_city_fails():
    assert validate_name_format("10_PA") is False


# ── names_are_similar ──────────────────────────────────────────────────────────

def test_similar_case_insensitive():
    assert names_are_similar("pa_10", "PA_10") is True

def test_similar_with_space_separator():
    assert names_are_similar("PA 10", "PA_10") is True

def test_not_similar_different_number():
    assert names_are_similar("PA_10", "PA_11") is False

def test_not_similar_different_city():
    assert names_are_similar("PA_10", "LYO_10") is False

def test_similar_both_unnormalized():
    assert names_are_similar("pa - 10", "PA 10") is True
