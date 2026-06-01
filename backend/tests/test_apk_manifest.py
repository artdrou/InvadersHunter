"""Tests for the APK version manifest and the /apk/download redirect route."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import requests

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "backend" / "static" / "apk" / "version.json"


def load_manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text())


# ── version.json structure ────────────────────────────────────────────────────

def test_manifest_exists():
    assert MANIFEST_PATH.exists()


def test_manifest_has_required_fields():
    data = load_manifest()
    assert "latestVersion" in data
    assert "url" in data


def test_manifest_url_is_absolute():
    data = load_manifest()
    assert data["url"].startswith("https://"), "APK URL must be an absolute HTTPS URL"


def test_manifest_url_points_to_apk():
    data = load_manifest()
    assert data["url"].endswith(".apk"), "APK URL must end with .apk"


def test_manifest_version_is_non_empty():
    data = load_manifest()
    assert data["latestVersion"].strip()


# ── GET /apk/download ─────────────────────────────────────────────────────────

def test_apk_download_redirects_to_manifest_url(client):
    data = load_manifest()
    res = client.get("/apk/download", follow_redirects=False)
    assert res.status_code == 307
    assert res.headers["location"] == data["url"]


def test_apk_download_503_when_manifest_missing(client):
    with patch("app.api.routers.apk._MANIFEST_PATH", Path("/nonexistent/version.json")):
        res = client.get("/apk/download", follow_redirects=False)
    assert res.status_code == 503


def test_apk_download_503_when_url_field_missing(client, tmp_path):
    broken = tmp_path / "version.json"
    broken.write_text(json.dumps({"latestVersion": "1.0.0"}))
    with patch("app.api.routers.apk._MANIFEST_PATH", broken):
        res = client.get("/apk/download", follow_redirects=False)
    assert res.status_code == 503


# ── network ───────────────────────────────────────────────────────────────────

@pytest.mark.network
def test_apk_url_is_reachable():
    url = load_manifest()["url"]
    res = requests.head(url, allow_redirects=True, timeout=10)
    assert res.status_code != 404, f"APK URL returned 404: {url}"
