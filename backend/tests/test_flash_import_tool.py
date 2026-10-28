"""The PC tool download serves the exe built for the backend it was fetched from."""
import pytest

URL = "/static/flash_import/HintVaders-FlashImport.exe"
OLD_URL = "/static/flash_import/InvadersHunter-FlashImport.exe"   # apps released before the rename


@pytest.mark.parametrize("host, env", [
    ("invader-hunter-production.up.railway.app", "production"),
    ("invader-hunter-staging.up.railway.app", "staging"),
    ("invader-hunter-development.up.railway.app", "development"),
    ("localhost:8000", "development"),
])
@pytest.mark.parametrize("url", [URL, OLD_URL])
def test_download_serves_exe_for_host(client, url, host, env):
    res = client.get(url, headers={"host": host})

    assert res.status_code == 200
    assert 'filename="HintVaders-FlashImport.exe"' in res.headers["content-disposition"]
    baked = res.content.decode("latin-1")
    assert f"invader-hunter-{env}.up.railway.app" in baked
    for other in {"production", "staging", "development"} - {env}:
        assert f"invader-hunter-{other}.up.railway.app" not in baked


def test_web_importer_short_address(client):
    for path in ("/flash-importer", "/flash-import/web"):
        res = client.get(path, follow_redirects=False)
        assert res.status_code == 307 and res.headers["location"] == "/flash-importer/"
    page = client.get("/flash-importer/")
    assert page.status_code == 200 and "HintVaders" in page.text
    assert client.get("/flash-importer/app.js").status_code == 200
