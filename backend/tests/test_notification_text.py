"""
Tests for news_service.notification_texts — the specific transition wording
(degraded, destroyed, hidden, reactivated, moved), in every supported app
language. Pure function: builds AdminRequest/Invader instances in memory, no
DB needed.
"""
from app.models.admin_request import AdminRequest
from app.models.space_invader import Invader
from app.services.news_service import notification_texts


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
    assert texts["fr"] == ("Nouvel Invader", "NY_42 a ete ajoute a la carte.")
    assert texts["en"] == ("New Invader", "NY_42 was added to the map.")


def test_create_event_without_name_uses_language_specific_fallback():
    req = AdminRequest(request_type="create", proposed_name=None)
    texts = notification_texts(req, None)
    assert texts["fr"] == ("Nouvel Invader", "Un nouvel invader a ete ajoute a la carte.")
    assert texts["en"] == ("New Invader", "A new invader was added to the map.")


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
    assert texts["fr"] == ("Invader invisible", "PA_10 n'est plus visible.")
    assert texts["en"] == ("Invader hidden", "PA_10 is no longer visible.")


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
    assert texts["fr"] == ("Invader mis a jour", "PA_10 a ete mis a jour.")
    assert texts["en"] == ("Invader updated", "PA_10 has been updated.")


def test_reappearing_from_hidden_falls_back_to_generic():
    """Not visible -> Good isn't in the requested transition list; falls back
    to the generic message rather than crashing or misreporting."""
    req = _modify_request()
    invader = _invader(state="Good")
    texts = notification_texts(req, invader, previous_state="Not visible")
    assert texts["fr"][0] == "Invader mis a jour"


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
    assert texts["fr"][0] == "Invader mis a jour"
