"""environment_for_host: which deployment a Host header points to."""
from app.core.environment import environment_for_host


def test_railway_hosts():
    assert environment_for_host("invader-hunter-staging.up.railway.app") == "staging"
    assert environment_for_host("invader-hunter-production.up.railway.app:443") == "production"


def test_public_domain_is_production():
    assert environment_for_host("hintvaders.app") == "production"
    assert environment_for_host("www.hintvaders.app") == "production"
    assert environment_for_host("HintVaders.app:443") == "production"


def test_unknown_hosts():
    assert environment_for_host("localhost:8000") is None
    assert environment_for_host("") is None
