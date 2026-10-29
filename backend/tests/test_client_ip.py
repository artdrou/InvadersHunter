"""Tests for client_ip: Railway's X-Real-IP, Cloudflare's CF-Connecting-IP only
when the request really came from Cloudflare."""
from starlette.requests import Request

from app.core.client_ip import client_ip


def _request(headers: dict, peer: str = "10.0.0.1") -> Request:
    return Request({
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (peer, 1234),
    })


def test_railway_real_ip_wins_over_forwarded_for():
    # X-Forwarded-For is sent by the caller and can be anything
    assert client_ip(_request({"X-Real-IP": "81.2.3.4", "X-Forwarded-For": "1.1.1.1"})) == "81.2.3.4"


def test_cloudflare_header_trusted_only_from_cloudflare():
    via_cf = {"X-Real-IP": "172.68.10.20", "CF-Connecting-IP": "81.2.3.4"}
    assert client_ip(_request(via_cf)) == "81.2.3.4"
    direct = {"X-Real-IP": "90.1.2.3", "CF-Connecting-IP": "81.2.3.4"}
    assert client_ip(_request(direct)) == "90.1.2.3"


def test_without_railway_falls_back():
    assert client_ip(_request({"X-Forwarded-For": "5.6.7.8, 10.0.0.2"})) == "5.6.7.8"
    assert client_ip(_request({})) == "10.0.0.1"
