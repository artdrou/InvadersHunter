"""
One-shot job: complete the invader catalogue from InvaderQuest's open data, then exit.

Run by a Railway Cron service (see backend/railway.invaderquest.json), once a day
after InvaderQuest's daily commit (~12:00-13:00 UTC):
  python -m app.jobs.invaderquest_sync

Local test (from /backend), no DB writes:
  venv/Scripts/python.exe -m app.jobs.invaderquest_sync --dry-run
  venv/Scripts/python.exe -m app.jobs.invaderquest_sync --city PA --dry-run
"""
import argparse
import logging
import sys

from .. import database
from ..migrate import run as run_migrations
from ..services import invaderquest_sync_service
from .spotter_sync import _register_models

log = logging.getLogger("invaderquest_sync")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Sync invaders from InvaderQuest (GitHub open data)")
    p.add_argument("--city", default=None, help="limit to one city code (e.g. PA)")
    p.add_argument("--force", action="store_true", help="re-read every city even if its version is unchanged")
    p.add_argument("--delay", type=float, default=invaderquest_sync_service.DEFAULT_DELAY_S,
                   help="seconds between city downloads")
    p.add_argument("--dry-run", action="store_true", help="report differences without writing")
    args = p.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s",
                        stream=sys.stdout, force=True)
    log.info("invaderquest sync starting: %s", vars(args))
    _register_models()
    if not args.dry_run:
        run_migrations()   # a cron run can start before the web deploy applied them

    db = database.SessionLocal()
    try:
        report = invaderquest_sync_service.sync(
            db, dry_run=args.dry_run, force=args.force, city=args.city, delay=args.delay,
        )
        if args.dry_run:
            db.rollback()
    except Exception:
        db.rollback()
        log.exception("invaderquest sync failed")
        return 1
    finally:
        db.close()

    for label, items in (
        ("created", report.created),
        ("created without location (list only)", report.created_without_location),
        ("filled empty fields", report.filled),
        (f"app location > {invaderquest_sync_service.FAR_LOCATION_M} m from InvaderQuest (kept)", report.far_locations),
        ("error", report.errors),
    ):
        if items:
            log.warning("%s (%d): %s", label, len(items), ", ".join(items[:50]) + (" ..." if len(items) > 50 else ""))
    log.info(report.summary())
    return 0


if __name__ == "__main__":
    sys.exit(main())
