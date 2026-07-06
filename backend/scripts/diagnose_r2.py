"""
Diagnose R2 connectivity. Verifies env vars, then puts and reads back a tiny
test object so we know whether the upload flow actually works end-to-end.

Run from /backend with the same env Railway uses (e.g. via `railway run`):
  railway run venv/Scripts/python.exe scripts/diagnose_r2.py
or locally if you have the vars in .env:
  venv/Scripts/python.exe scripts/diagnose_r2.py
"""
import os
import sys
import uuid
import urllib.request

# Minimal .env loader so the script works without `railway run`
_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(_env_path):
    for line in open(_env_path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

import boto3
from botocore.config import Config

VARS = ["R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]

print("=== Env vars ===")
missing = []
for v in VARS:
    val = os.getenv(v)
    if val:
        masked = val if v == "R2_BUCKET" or v == "R2_PUBLIC_URL" or v == "R2_ENDPOINT_URL" else val[:4] + "…" + val[-4:]
        print(f"  {v}: {masked}")
    else:
        print(f"  {v}: MISSING")
        missing.append(v)

if missing:
    print(f"\nFAIL — missing env vars: {missing}")
    sys.exit(1)

endpoint = os.getenv("R2_ENDPOINT_URL")
key_id   = os.getenv("R2_ACCESS_KEY_ID")
secret   = os.getenv("R2_SECRET_ACCESS_KEY")
bucket   = os.getenv("R2_BUCKET")
public   = os.getenv("R2_PUBLIC_URL").rstrip("/")

print("\n=== Building S3 client ===")
client = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=key_id,
    aws_secret_access_key=secret,
    config=Config(signature_version="s3v4"),
)
print("  client built")

print("\n=== Listing bucket (verifies auth + bucket name) ===")
try:
    resp = client.list_objects_v2(Bucket=bucket, MaxKeys=1)
    print(f"  list_objects_v2 OK — {resp.get('KeyCount', 0)} keys returned (max 1)")
except Exception as e:
    print(f"  FAIL: {e}")
    sys.exit(1)

print("\n=== Putting a test object ===")
key = f"diagnostics/test_{uuid.uuid4().hex[:8]}.txt"
body = b"hello from diagnose_r2"
try:
    client.put_object(Bucket=bucket, Key=key, Body=body, ContentType="text/plain")
    print(f"  put_object OK at key {key}")
except Exception as e:
    print(f"  FAIL: {e}")
    sys.exit(1)

print("\n=== Fetching the object via the public URL ===")
url = f"{public}/{key}"
print(f"  GET {url}")
try:
    with urllib.request.urlopen(url, timeout=10) as r:
        fetched = r.read()
        print(f"  HTTP {r.status} -- {len(fetched)} bytes")
        if fetched != body:
            print(f"  FAIL: body mismatch ({fetched!r} != {body!r})")
            sys.exit(1)
except urllib.error.HTTPError as e:
    print(f"  FAIL: HTTP {e.code}")
    try:
        print(f"  response headers: {dict(e.headers)}")
        print(f"  response body: {e.read().decode('utf-8', 'replace')}")
    except Exception:
        pass
    print("  -> R2_PUBLIC_URL may be wrong, or bucket isn't set to allow public reads")
    sys.exit(1)
except Exception as e:
    print(f"  FAIL: {e}")
    sys.exit(1)

print("\n=== Cleanup ===")
client.delete_object(Bucket=bucket, Key=key)
print(f"  deleted {key}")

print("\nALL CHECKS PASSED — R2 upload + public read works.")
