"""
Tests for news_service.notification_texts — the specific transition wording
(degraded, destroyed, hidden, reactivated, moved), in every supported app
language. Pure function: builds AdminRequest/Invader instances in memory, no
DB needed.
"""
import json
from pathlib import Path

import pytest

from app.models.admin_request import AdminRequest
from app.models.space_invader import Invader
from app.services.news_service import NOTIFICATION_COPY, classify_event, notification_texts

LOCALES_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "locales"


def _invader(**overrides) -> Invader:
    defaults = dict(name="PA_10", state="Good", latitude=48.8566, longitude=2.3522)
    defaults.update(overrides)
    return Invader(**defaults)


def _modify_request(**overrides) -> AdminRequest:
    defaults = dict(request_type="modify")
    defaults.update(overrides)
    return AdminRequest(**defaults)


def test_create_event():
    req = AdminRequest(request_type="create", proposed_name="NY_42")
    texts = notification_texts(req, _invader(name="NY_42"))
    assert texts["fr"] == ("Nouvel invader", "NY_42 a ete ajoute a la carte.")
    assert texts["en"] == ("New invader", "NY_42 was added to the map.")


def test_create_event_without_name_uses_language_specific_fallback():
    req = AdminRequest(request_type="create", proposed_name=None)
    texts = notification_texts(req, None)
    assert texts["fr"] == ("Nouvel invader", "Un nouvel invader a ete ajoute a la carte.")
    assert texts["en"] == ("New invader", "A new invader was added to the map.")


def test_degradation_from_good():
    req = _modify_request()
    invader = _invader(state="Degraded")
    texts = notification_texts(req, invader, previous_state="Good")
    assert texts["fr"] == ("Invader degrade", "PA_10 s'est degrade.")
    assert texts["en"] == ("Invader degraded", "PA_10 has degraded.")


def test_destruction_from_good():
    req = _modify_request()
    invader = _invader(state="Destroyed")
    texts = notification_texts(req, invader, previous_state="Good")
    assert texts["fr"] == ("Invader detruit", "PA_10 a ete detruit.")
    assert texts["en"] == ("Invader destroyed", "PA_10 has been destroyed.")


def test_destruction_from_degraded():
    req = _modify_request()
    invader = _invader(state="Destroyed")
    texts = notification_texts(req, invader, previous_state="Badly degraded")
    assert texts["fr"][0] == "Invader detruit"


def test_hiding_from_any_state():
    req = _modify_request()
    invader = _invader(state="Not visible")
    texts = notification_texts(req, invader, previous_state="Slightly degraded")
    assert texts["fr"] == ("Invader non visible", "PA_10 n'est plus visible.")
    assert texts["en"] == ("Invader not visible", "PA_10 is no longer visible.")


def test_reactivated_from_destroyed_to_good():
    req = _modify_request()
    invader = _invader(state="Good")
    texts = notification_texts(req, invader, previous_state="Destroyed")
    assert texts["fr"] == ("Invader reactive", "PA_10 a ete reactive.")
    assert texts["en"] == ("Invader reactivated", "PA_10 has been reactivated.")


def test_moved_only():
    req = _modify_request()
    invader = _invader(state="Good", latitude=40.71, longitude=-74.00)
    texts = notification_texts(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert texts["fr"] == ("Invader deplace", "PA_10 a change d'emplacement.")
    assert texts["en"] == ("Invader moved", "PA_10's location has changed.")


def test_generic_update_for_unrelated_change():
    req = _modify_request()
    invader = _invader(state="Good")  # same state, same coords
    texts = notification_texts(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert texts["fr"] == ("Invader modifie", "PA_10 a ete modifie.")
    assert texts["en"] == ("Invader updated", "PA_10 has been updated.")


def test_reappearing_from_hidden_counts_as_reactivated():
    """Not visible -> Good is treated the same as Destroyed -> Good: the
    invader is visible/flashable again either way."""
    req = _modify_request()
    invader = _invader(state="Good")
    texts = notification_texts(req, invader, previous_state="Not visible")
    assert texts["fr"][0] == "Invader reactive"


def test_destruction_takes_priority_over_move():
    """When both state and location change in the same approval, the more
    newsworthy transition (destruction) wins over the location change."""
    req = _modify_request()
    invader = _invader(state="Destroyed", latitude=40.71, longitude=-74.00)
    texts = notification_texts(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert texts["fr"][0] == "Invader detruit"


def test_tiny_float_drift_is_not_a_move():
    req = _modify_request()
    invader = _invader(state="Good", latitude=48.85660000001, longitude=2.3522)
    texts = notification_texts(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert texts["fr"][0] == "Invader modifie"


@pytest.mark.parametrize("previous, new, kind", [
    ("Good", "Slightly degraded", "degraded"),
    ("Degraded", "Badly degraded", "degraded"),
    ("Badly degraded", "Good", "restored"),
    ("Degraded", "Slightly degraded", "restored"),
    ("Destroyed", "Degraded", "reactivated"),
    ("Not visible", "Good", "reactivated"),
    ("Destroyed", "Not visible", "hidden"),
    ("Not visible", "Destroyed", "destroyed"),
    ("Good", "Unknown", "unknown"),            # grey
    ("Destroyed", "Unknown", "unknown"),
    ("Unknown", "Good", "discovered"),         # green
    ("Unknown", "Destroyed", "destroyed"),     # red
    ("Unknown", "Badly degraded", "degraded"),  # mustard
    ("Unknown", "Not visible", "hidden"),
    ("active", "Good", "state_changed"),       # legacy non-canonical state
    (None, "Good", "state_changed"),     # News rows from before previous_state was recorded
    ("Good", "Good", "updated"),         # state re-proposed unchanged
    ("Good", None, "updated"),
])
def test_classify_every_state_transition(previous, new, kind):
    assert classify_event("modify", previous, new, moved=False) == kind


def test_unchanged_state_with_move_is_a_move():
    assert classify_event("modify", "Good", "Good", moved=True) == "moved"


def test_restoration_push():
    texts = notification_texts(_modify_request(), _invader(state="Good"), previous_state="Degraded")
    assert texts["fr"] == ("Invader restaure", "PA_10 a ete restaure.")
    assert texts["en"] == ("Invader restored", "PA_10 has been restored.")


def test_state_change_push():
    texts = notification_texts(_modify_request(), _invader(state="Good"), previous_state=None)
    assert texts["fr"] == ("Etat modifie", "PA_10 a change d'etat.")
    assert texts["en"] == ("State changed", "PA_10's state has changed.")


def test_unknown_and_discovered_pushes():
    lost = notification_texts(_modify_request(), _invader(state="Unknown"), previous_state="Good")
    assert lost["fr"] == ("Etat inconnu", "PA_10 n'a plus d'etat connu.")
    found = notification_texts(_modify_request(), _invader(state="Good"), previous_state="Unknown")
    assert found["fr"] == ("Invader decouvert", "PA_10 a ete decouvert en bon etat.")
    assert found["en"] == ("Invader discovered", "PA_10 has been found in good condition.")


def _locale_key(kind: str) -> str:
    return "kind" + "".join(part.capitalize() for part in kind.split("_"))


@pytest.mark.parametrize("lang", ["fr", "en"])
def test_push_titles_match_news_feed_labels(lang):
    """The News feed chip (frontend locale news.kind<Kind>) and the push title
    must name each event the same way."""
    news = json.loads((LOCALES_DIR / f"{lang}.json").read_text(encoding="utf-8"))["news"]
    for kind, copy in NOTIFICATION_COPY.items():
        assert news.get(_locale_key(kind)) == copy[lang][0], kind
