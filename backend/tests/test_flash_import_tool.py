"""The PC tool download serves the exe built for the backend it was fetched from."""
import pytest

URL = "/static/flash_import/InvadersHunter-FlashImport.exe"


@pytest.mark.parametrize("host, env", [
    ("invader-hunter-production.up.railway.app", "production"),
    ("invader-hunter-staging.up.railway.app", "staging"),
    ("invader-hunter-development.up.railway.app", "development"),
    ("localhost:8000", "development"),
])
def test_download_serves_exe_for_host(client, host, env):
    res = client.get(URL, headers={"host": host})

    assert res.status_code == 200
    assert 'filename="InvadersHunter-FlashImport.exe"' in res.headers["content-disposition"]
    baked = res.content.decode("latin-1")
    assert f"invader-hunter-{env}.up.railway.app" in baked
    for other in {"production", "staging", "development"} - {env}:
        assert f"invader-hunter-{other}.up.railway.app" not in baked
