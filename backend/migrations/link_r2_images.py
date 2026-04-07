"""
Migration script: link existing R2 images to invader rows in DB.

Use this when invader entries have been re-created and image_url is empty,
but the images are already uploaded to R2 under keys matching invader names
(e.g. "PA_10.png" links to the invader named "PA_10").

Reads credentials from backend/.env:
    R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL

Usage:
    python migrations/link_r2_images.py

Options:
    --overwrite   Also update rows that already have an image_url (default: skip them)
    --dry-run     Preview matches without writing to DB
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

try:
    import boto3
except ImportError:
    print("ERROR: boto3 is not installed. Run: pip install boto3")
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models.space_invader import Invader


def parse_args():
    parser = argparse.ArgumentParser(
        description="Link existing R2 images to invader rows in DB."
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Update image_url even if it is already set (default: skip)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview matches without writing to DB",
    )
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


def get_public_url_base() -> str:
    url = os.getenv("R2_PUBLIC_URL", "")
    if not url or "your_" in url:
        print("ERROR: R2_PUBLIC_URL is not set in .env")
        sys.exit(1)
    return url.rstrip("/")


def list_bucket_keys(client, bucket: str) -> list[str]:
    keys = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


def main():
    args = parse_args()

    bucket     = os.getenv("R2_BUCKET", "invaderhunter-pictures")
    public_url = get_public_url_base()

    print(f"Bucket      : {bucket}")
    print(f"Public URL  : {public_url}")
    print(f"Overwrite   : {args.overwrite}")
    print(f"Dry run     : {args.dry_run}")
    print()

    client = get_r2_client()

    print("Listing bucket contents…")
    keys = list_bucket_keys(client, bucket)
    print(f"  {len(keys)} file(s) found in bucket")
    print()

    db = SessionLocal()
    try:
        invader_map: dict[str, Invader] = {inv.name: inv for inv in db.query(Invader).all()}
        print(f"  {len(invader_map)} invader(s) found in DB")
        print()

        linked    = 0
        skipped   = 0
        no_match  = 0

        for key in sorted(keys):
            invader_name = Path(key).stem          # "PA_10.png" -> "PA_10"
            image_url    = f"{public_url}/{key}"
            invader      = invader_map.get(invader_name)

            if invader is None:
                print(f"  NO MATCH  {key}")
                no_match += 1
                continue

            if invader.image_url and not args.overwrite:
                print(f"  SKIP      {key}  (already set)")
                skipped += 1
                continue

            if args.dry_run:
                action = "UPDATE" if invader.image_url else "LINK  "
                print(f"  DRY {action}  {key}  →  {invader_name}")
            else:
                invader.image_url = image_url
                action = "UPDATE" if invader.image_url else "LINK  "
                print(f"  {action}     {key}  →  {invader_name}")

            linked += 1

        if not args.dry_run:
            db.commit()
            print("\nDB changes committed.")
        else:
            print("\nDry run — nothing written to DB.")

        print()
        print(f"Done.  linked={linked}  skipped={skipped}  no_db_match={no_match}")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
