from fastapi import Request


def client_ip(request: Request) -> str:
    """The caller's IP. Behind Railway's proxy the socket peer is an internal
    address: use the forwarded one."""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "?")
