"""
Migration script: upload invader images to Cloudflare R2 and update image_url in DB.

Reads credentials from backend/.env:
    R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL

Files are uploaded with their normalized filename as the key (e.g. "AIX_1.png").
After a successful upload, the invader row matching that name has its image_url updated
to the public URL: {R2_PUBLIC_URL}/{key}

Usage:
    python migrations/upload_images_to_r2.py <folder_path>

Options:
    --on-conflict skip       Skip files already in the bucket  (default)
    --on-conflict overwrite  Re-upload and overwrite existing files
    --dry-run                Preview what would happen without uploading or writing to DB

Example:
    python migrations/upload_images_to_r2.py ../frontend/assets/images/invaders/pictures --dry-run
    python migrations/upload_images_to_r2.py ../frontend/assets/images/invaders/pictures
"""

import argparse
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("ERROR: boto3 is not installed. Run: pip install boto3")
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models.space_invader import Invader

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

CONTENT_TYPES = {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".webp": "image/webp",
    ".gif":  "image/gif",
    ".bmp":  "image/bmp",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Upload invader images to Cloudflare R2 and update image_url in DB."
    )
    parser.add_argument("folder", help="Folder containing the images to upload")
    parser.add_argument(
        "--on-conflict",
        choices=["skip", "overwrite"],
        default="skip",
        dest="on_conflict",
        help="What to do if the file already exists in the bucket (default: skip)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would happen without uploading or writing to DB",
    )
    return parser.parse_args()


def normalize_filename(filename: str) -> str:
    """Strip leading zeros from the number part of the filename stem.

    Examples:
        AIX_01.png   -> AIX_1.png
        PA_0012.jpg  -> PA_12.jpg
    """
    p = Path(filename)
    normalized_stem = re.sub(r'_0*(\d+)$', lambda m: f"_{int(m.group(1))}", p.stem.upper())
    return normalized_stem + p.suffix.lower()


def invader_name_from_key(key: str) -> str:
    """Extract the invader DB name (no extension) from a normalized key."""
    return Path(key).stem  # e.g. "AIX_1.png" -> "AIX_1"


def get_r2_client():
    endpoint   = os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

    missing = [k for k, v in {
        "R2_ENDPOINT_URL":    endpoint,
        "R2_ACCESS_KEY_ID":   access_key,
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
        print("  Set it to your bucket's public URL, e.g.:")
        print("  https://pub-xxxxxxxxxxxxxxxx.r2.dev")
        sys.exit(1)
    return url.rstrip("/")


def get_existing_keys(client, bucket: str) -> set[str]:
    existing = set()
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            existing.add(obj["Key"])
    return existing


def main():
    args = parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"ERROR: folder not found: {folder}")
        sys.exit(1)

    files = [f for f in sorted(folder.iterdir()) if f.suffix.lower() in IMAGE_EXTENSIONS]
    if not files:
        print(f"No image files found in {folder}")
        sys.exit(0)

    bucket     = os.getenv("R2_BUCKET", "invaderhunter-pictures")
    public_url = get_public_url_base()

    print(f"Folder      : {folder}")
    print(f"Images      : {len(files)}")
    print(f"Bucket      : {bucket}")
    print(f"Public URL  : {public_url}")
    print(f"On conflict : {args.on_conflict}")
    print(f"Dry run     : {args.dry_run}")
    print()

    client = get_r2_client()

    print("Fetching existing keys from bucket…")
    existing_keys = get_existing_keys(client, bucket)
    print(f"  {len(existing_keys)} file(s) already in bucket")
    print()

    BATCH_SIZE   = 100
    MAX_WORKERS  = 16  # parallel upload threads

    def upload_one(f: Path):
        """Upload a single file to R2. Returns (f, key, image_url, action) or raises."""
        key            = normalize_filename(f.name)
        content_type   = CONTENT_TYPES.get(f.suffix.lower(), "application/octet-stream")
        already_exists = key in existing_keys
        image_url      = f"{public_url}/{key}"

        if already_exists and args.on_conflict == "skip":
            return (f, key, image_url, "skip")

        client.upload_file(
            str(f),
            bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        return (f, key, image_url, "overwrite" if already_exists else "upload")

    db = SessionLocal()
    try:
        invader_map = {inv.name: inv for inv in db.query(Invader).all()}

        uploaded    = 0
        overwritten = 0
        skipped     = 0
        db_updated  = 0
        no_match    = 0
        batch_count = 0

        if args.dry_run:
            for f in files:
                key          = normalize_filename(f.name)
                invader_name = invader_name_from_key(key)
                already_exists = key in existing_keys
                action       = "OVERWRITE" if already_exists else "UPLOAD"
                db_action    = "update DB" if invader_map.get(invader_name) else "no match in DB"
                print(f"  DRY {action:<9} {f.name}  →  {key}  ({db_action})")
            print("\nDry run — nothing uploaded or written to DB.")
        else:
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = {executor.submit(upload_one, f): f for f in files}
                for future in as_completed(futures):
                    try:
                        f, key, image_url, action = future.result()
                    except ClientError as e:
                        print(f"  ERROR     {futures[future].name}: {e}")
                        continue

                    invader_name = invader_name_from_key(key)
                    invader      = invader_map.get(invader_name)

                    if action == "skip":
                        print(f"  SKIP      {f.name}  →  {key}")
                        skipped += 1
                        if invader and not invader.image_url:
                            invader.image_url = image_url
                            db_updated += 1
                            batch_count += 1
                            print(f"            DB updated (url was missing)  [{invader_name}]")
                    elif action == "overwrite":
                        print(f"  OVERWRITE {f.name}  →  {key}")
                        overwritten += 1
                    else:
                        print(f"  UPLOAD    {f.name}  →  {key}")
                        uploaded += 1

                    if action != "skip":
                        if invader:
                            invader.image_url = image_url
                            db_updated += 1
                            batch_count += 1
                        else:
                            print(f"            DB no match [{invader_name}]")
                            no_match += 1

                    if batch_count >= BATCH_SIZE:
                        db.commit()
                        print(f"  [batch commit — {db_updated} DB updates so far]")
                        batch_count = 0

            db.commit()
            print("\nDB changes committed.")

        print()
        print(
            f"Done.  uploaded={uploaded}  overwritten={overwritten}  "
            f"skipped={skipped}  db_updated={db_updated}  no_db_match={no_match}"
        )

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
