"""
Tests for news_service.notification_text — the specific transition wording
(degraded, destroyed, hidden, reactivated, moved) used in push notifications.
Pure function: builds AdminRequest/Invader instances in memory, no DB needed.
"""
from app.models.admin_request import AdminRequest
from app.models.space_invader import Invader
from app.services.news_service import notification_text


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
    title, body = notification_text(req, _invader(name="NY_42"))
    assert title == "Nouvel Invader"
    assert body == "NY_42 a ete ajoute a la carte."


def test_degradation_from_good():
    req = _modify_request()
    invader = _invader(state="Degraded")
    title, body = notification_text(req, invader, previous_state="Good")
    assert title == "Invader degrade"
    assert body == "PA_10 s'est degrade."


def test_destruction_from_good():
    req = _modify_request()
    invader = _invader(state="Destroyed")
    title, body = notification_text(req, invader, previous_state="Good")
    assert title == "Invader detruit"
    assert body == "PA_10 a ete detruit."


def test_destruction_from_degraded():
    req = _modify_request()
    invader = _invader(state="Destroyed")
    title, body = notification_text(req, invader, previous_state="Badly degraded")
    assert title == "Invader detruit"


def test_hiding_from_any_state():
    req = _modify_request()
    invader = _invader(state="Not visible")
    title, body = notification_text(req, invader, previous_state="Slightly degraded")
    assert title == "Invader invisible"
    assert body == "PA_10 n'est plus visible."


def test_reactivated_from_destroyed_to_good():
    req = _modify_request()
    invader = _invader(state="Good")
    title, body = notification_text(req, invader, previous_state="Destroyed")
    assert title == "Invader reactive"
    assert body == "PA_10 a ete reactive."


def test_moved_only():
    req = _modify_request()
    invader = _invader(state="Good", latitude=40.71, longitude=-74.00)
    title, body = notification_text(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert title == "Invader deplace"
    assert body == "PA_10 a change d'emplacement."


def test_generic_update_for_unrelated_change():
    req = _modify_request()
    invader = _invader(state="Good")  # same state, same coords
    title, body = notification_text(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert title == "Invader mis a jour"
    assert body == "PA_10 a ete mis a jour."


def test_reappearing_from_hidden_falls_back_to_generic():
    """Not visible -> Good isn't in the requested transition list; falls back
    to the generic message rather than crashing or misreporting."""
    req = _modify_request()
    invader = _invader(state="Good")
    title, _ = notification_text(req, invader, previous_state="Not visible")
    assert title == "Invader mis a jour"


def test_destruction_takes_priority_over_move():
    """When both state and location change in the same approval, the more
    newsworthy transition (destruction) wins over the location change."""
    req = _modify_request()
    invader = _invader(state="Destroyed", latitude=40.71, longitude=-74.00)
    title, _ = notification_text(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert title == "Invader detruit"


def test_tiny_float_drift_is_not_a_move():
    req = _modify_request()
    invader = _invader(state="Good", latitude=48.85660000001, longitude=2.3522)
    title, _ = notification_text(
        req, invader, previous_state="Good", previous_latitude=48.8566, previous_longitude=2.3522,
    )
    assert title == "Invader mis a jour"
