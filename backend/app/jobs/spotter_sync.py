"""
One-shot job: align invader states with invader-spotter.art, then exit.

Run by Railway Cron services (see backend/railway.spotter-*.json):
  python -m app.jobs.spotter_sync --mode news     # twice a day
  python -m app.jobs.spotter_sync --mode full     # once a week, silent (add --notify to push)

Local test (from /backend), no DB writes:
  venv/Scripts/python.exe -m app.jobs.spotter_sync --mode news --dry-run
  venv/Scripts/python.exe -m app.jobs.spotter_sync --mode full --city STK --dry-run
"""
import argparse
import importlib
import logging
import pkgutil
import sys

from .. import database, models
from ..services import spotter_sync_service

log = logging.getLogger("spotter_sync")


def _register_models() -> None:
    """Outside FastAPI nothing imports the models: load them all so FKs resolve."""
    for mod in pkgutil.iter_modules(models.__path__):
        importlib.import_module(f"{models.__name__}.{mod.name}")


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Sync invader states from invader-spotter.art")
    p.add_argument("--mode", choices=["news", "full"], required=True)
    p.add_argument("--days", type=int, default=spotter_sync_service.DEFAULT_NEWS_DAYS,
                   help="news mode: how many days of news to re-check")
    p.add_argument("--city", default=None, help="full mode: limit to one city code (e.g. PA)")
    p.add_argument("--delay", type=float, default=spotter_sync_service.DEFAULT_DELAY_S,
                   help="seconds between requests to the site")
    p.add_argument("--dry-run", action="store_true", help="report differences without writing")
    p.add_argument("--notify", action="store_true",
                   help="full mode: send push notifications (news mode always does)")
    args = p.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s",
                        stream=sys.stdout, force=True)
    log.info("spotter sync starting: %s", vars(args))
    _register_models()

    db = database.SessionLocal()
    try:
        if args.mode == "news":
            report = spotter_sync_service.sync_from_news(db, days=args.days, dry_run=args.dry_run, delay=args.delay)
        else:
            report = spotter_sync_service.sync_full(
                db, dry_run=args.dry_run, delay=args.delay, city=args.city, notify=args.notify,
            )
        if args.dry_run:
            db.rollback()
    except Exception:
        db.rollback()
        log.exception("spotter sync failed")
        return 1
    finally:
        db.close()

    for c in report.changes:
        log.info("changed %s: %s -> %s", c.name, c.old_state, c.new_state)
    for label, items in (
        ("not in DB", report.missing_in_db),
        ("not found on site", report.missing_on_site),
        ("unparsed state", report.unparsed_state),
        ("error", report.errors),
    ):
        if items:
            log.warning("%s (%d): %s", label, len(items), ", ".join(items[:50]) + (" ..." if len(items) > 50 else ""))
    log.info(report.summary())
    return 0


if __name__ == "__main__":
    sys.exit(main())
