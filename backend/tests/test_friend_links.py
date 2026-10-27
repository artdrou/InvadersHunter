"""Friend links: the /f/<code> landing page and Android asset links."""
from app.models.user import User
from app.core.security import hash_password

from tests.conftest import auth_headers


def _user(db, name):
    u = User(username=name, email=f"{name}@test.com", hashed_password=hash_password("pw"))
    db.add(u)
    db.flush()
    return u


def _code(client, user):
    return client.get("/friends/code", headers=auth_headers(user)).json()["code"]


def test_landing_names_inviter_and_shows_code(client, db):
    bob = _user(db, "Bob")
    code = _code(client, bob)
    res = client.get(f"/f/{code.replace('-', '').lower()}", headers={"accept-language": "fr-FR"})
    assert res.status_code == 200
    assert "<b>Bob</b>" in res.text
    assert code in res.text
    assert "intent://f/" + code in res.text
    assert "scheme=hintvaders" in res.text


def test_landing_in_english(client, db):
    bob = _user(db, "Bob")
    res = client.get(f"/f/{_code(client, bob)}", headers={"accept-language": "en-US,en"})
    assert "invites you" in res.text


def test_landing_unknown_code(client):
    res = client.get("/f/ZZZZ-ZZZZ")
    assert res.status_code == 200
    assert "intent://" not in res.text


def test_landing_escapes_username(client, db):
    evil = _user(db, "<script>x</script>")
    res = client.get(f"/f/{_code(client, evil)}")
    assert "<script>x</script>" not in res.text


def test_package_follows_the_backend(client, db):
    from app.services.friend_link_service import package_for_host
    assert package_for_host("invader-hunter-staging.up.railway.app") == "com.invaderhunter.app.stag"
    assert package_for_host("invader-hunter-production.up.railway.app") == "com.invaderhunter.app"
    assert package_for_host("localhost:8000") == "com.invaderhunter.app"


def test_asset_links_empty_without_fingerprint(client, monkeypatch):
    monkeypatch.delenv("ANDROID_CERT_SHA256", raising=False)
    assert client.get("/.well-known/assetlinks.json").json() == []


def test_asset_links_with_fingerprints(client, monkeypatch):
    monkeypatch.setenv("ANDROID_CERT_SHA256", "aa:bb, cc:dd")
    links = client.get("/.well-known/assetlinks.json").json()
    assert {l["target"]["package_name"] for l in links} == {
        "com.invaderhunter.app", "com.invaderhunter.app.stag", "com.invaderhunter.app.dev",
    }
    assert links[0]["target"]["sha256_cert_fingerprints"] == ["AA:BB", "CC:DD"]
