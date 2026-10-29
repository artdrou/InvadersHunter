from ipaddress import ip_address, ip_network

from fastapi import Request

# https://www.cloudflare.com/ips/ (hintvaders.app goes through Cloudflare's proxy)
CLOUDFLARE_NETWORKS = [ip_network(n) for n in (
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
    "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
    "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
    "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
    "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
)]


def _from_cloudflare(ip: str) -> bool:
    try:
        address = ip_address(ip)
    except ValueError:
        return False
    return any(address in network for network in CLOUDFLARE_NETWORKS)


def client_ip(request: Request) -> str:
    """The caller's IP. Railway's edge puts the address it sees in X-Real-IP (set
    by Railway, can't be faked). When that address is Cloudflare's, the request
    came through hintvaders.app's proxy: the real caller is in CF-Connecting-IP.
    Without Railway (local dev, tests): the first X-Forwarded-For, else the socket."""
    peer = request.headers.get("x-real-ip", "").strip()
    if peer:
        if _from_cloudflare(peer):
            return request.headers.get("cf-connecting-ip", "").strip() or peer
        return peer
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "?")
