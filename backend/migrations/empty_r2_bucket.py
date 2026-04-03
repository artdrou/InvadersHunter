"""
Migration script: delete all objects from the R2 bucket.

Usage:
    python migrations/empty_r2_bucket.py

Options:
    --dry-run   List what would be deleted without doing it

Example:
    python migrations/empty_r2_bucket.py --dry-run
    python migrations/empty_r2_bucket.py
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("ERROR: boto3 is not installed. Run: pip install boto3")
    sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(description="Delete all objects from the R2 bucket.")
    parser.add_argument("--dry-run", action="store_true", help="List objects without deleting")
    return parser.parse_args()


def get_r2_client():
    endpoint   = os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

    missing = [k for k, v in {
        "R2_ENDPOINT_URL":      endpoint,
        "R2_ACCESS_KEY_ID":     access_key,
        "R2_SECRET_ACCESS_KEY": secret_key,
    }.items() if not v or "your_" in (v or "")]

    if missing:
        print(f"ERROR: missing or placeholder values in .env: {', '.join(missing)}")
        sys.exit(1)

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def main():
    args = parse_args()
    bucket = os.getenv("R2_BUCKET", "invaderhunter-pictures")
    client = get_r2_client()

    print(f"Bucket  : {bucket}")
    print(f"Dry run : {args.dry_run}")
    print()

    # Collect all keys
    print("Listing objects…")
    keys = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])

    print(f"  {len(keys)} object(s) found")
    print()

    if not keys:
        print("Bucket is already empty.")
        return

    if args.dry_run:
        for key in keys:
            print(f"  DRY DELETE  {key}")
        print(f"\nDry run — nothing deleted.")
        return

    # Delete in batches of 1000 (R2/S3 limit per delete_objects call)
    BATCH = 1000
    deleted = 0
    for i in range(0, len(keys), BATCH):
        batch = keys[i:i + BATCH]
        response = client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": k} for k in batch]},
        )
        deleted += len(response.get("Deleted", []))
        errors = response.get("Errors", [])
        for err in errors:
            print(f"  ERROR  {err['Key']}: {err['Message']}")
        print(f"  Deleted batch {i // BATCH + 1} ({deleted} total so far)")

    print(f"\nDone. {deleted} object(s) deleted from '{bucket}'.")


if __name__ == "__main__":
    main()
