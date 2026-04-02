"""
Migration script: create user_progress entries from image filenames in a folder.

Filenames are expected to follow the invader naming convention, e.g.:
    PA_12.jpg, AIX_1.png, LDN_42.jpeg, ...

The invader name is extracted from the filename (stem, uppercased).
Files that don't match an invader in the DB are reported and skipped.
Duplicates (progress already exists for that user+invader) are silently ignored.

Usage:
    python migrations/import_progress_from_folder.py <username> <folder_path>

Options:
    --dry-run    Preview what would be inserted without writing to the DB

Example:
    python migrations/import_progress_from_folder.py adrou ./my_flashed_pics --dry-run
    python migrations/import_progress_from_folder.py adrou ./my_flashed_pics
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models.user import User
from app.models.space_invader import Invader
from app.models.user_progress import UserProgress

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Import user progress from image filenames in a folder."
    )
    parser.add_argument("username", help="Username to assign the progress to")
    parser.add_argument("folder", help="Path to the folder containing the images")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be inserted without writing to the DB",
    )
    return parser.parse_args()


def extract_invader_name(filename: str) -> str | None:
    """Extract and normalize invader name from a filename stem.

    Examples:
        PA_0012.jpg  -> PA_12
        AIX_01.png   -> AIX_1
        random.jpg   -> None (no underscore pattern)
    """
    import re
    stem = Path(filename).stem.upper()
    # Must match LETTERS_DIGITS pattern
    if not re.match(r'^[A-Z]+_\d+$', stem):
        return None
    # Strip leading zeros from the number part
    return re.sub(r'_0*(\d+)$', lambda m: f"_{int(m.group(1))}", stem)


def main():
    args = parse_args()

    folder = Path(args.folder)
    if not folder.is_dir():
        print(f"ERROR: folder not found: {folder}")
        sys.exit(1)

    # Collect image files
    files = [f for f in folder.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS]
    if not files:
        print(f"No image files found in {folder}")
        sys.exit(0)

    print(f"User       : {args.username}")
    print(f"Folder     : {folder}")
    print(f"Images     : {len(files)}")
    print(f"Dry run    : {args.dry_run}")
    print()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == args.username).first()
        if not user:
            print(f"ERROR: user '{args.username}' not found in DB")
            sys.exit(1)

        # Build a lookup: invader name -> invader id
        invader_map = {inv.name: inv.id for inv in db.query(Invader).all()}

        # Build existing progress set for this user to detect duplicates
        existing = {
            row.invader_id
            for row in db.query(UserProgress).filter(UserProgress.user_id == user.id).all()
        }

        inserted = 0
        skipped_duplicate = 0
        skipped_no_match = 0
        skipped_bad_name = 0

        now = datetime.now(timezone.utc)

        for f in sorted(files):
            name = extract_invader_name(f.name)

            if name is None:
                print(f"  SKIP (bad name)  {f.name}")
                skipped_bad_name += 1
                continue

            invader_id = invader_map.get(name)
            if invader_id is None:
                print(f"  SKIP (not in DB) {f.name}  [{name}]")
                skipped_no_match += 1
                continue

            if invader_id in existing:
                print(f"  SKIP (duplicate) {f.name}  [{name}]")
                skipped_duplicate += 1
                continue

            print(f"  INSERT           {f.name}  [{name}]")
            if not args.dry_run:
                db.add(UserProgress(user_id=user.id, invader_id=invader_id, found_at=now))
                existing.add(invader_id)
            inserted += 1

        if not args.dry_run:
            db.commit()
            print("\nChanges committed to database.")
        else:
            print("\nDry run — no changes written.")

        print()
        print(f"Done.  inserted={inserted}  duplicate={skipped_duplicate}  "
              f"no_match={skipped_no_match}  bad_name={skipped_bad_name}")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
