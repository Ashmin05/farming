"""Manually run the mandi price sync -- the same code the nightly job runs
(app/jobs/scheduler.py: run_nightly_mandi_price_sync).

From backend/:
    python scripts/sync_mandi_prices.py                        # everything, all states
    python scripts/sync_mandi_prices.py --state Maharashtra --commodity Onion
    python scripts/sync_mandi_prices.py --max-records 10 --page-size 10   # quick check

Exits non-zero if the sync fails or no DATA_GOV_IN_API_KEY is set.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.integrations.agmarknet_client import MAX_RECORDS_PER_SYNC, AgmarknetClient  # noqa: E402
from app.repositories.mandi_price_repository import MandiPriceRepository  # noqa: E402
from app.services.price_service import PriceService  # noqa: E402


async def main(args: argparse.Namespace) -> int:
    client = AgmarknetClient(settings.DATA_GOV_IN_API_KEY, page_size=args.page_size)
    if not client.configured:
        print("DATA_GOV_IN_API_KEY is not set in .env -- nothing to do.")
        return 1

    async with AsyncSessionLocal() as session:
        sync = await PriceService(MandiPriceRepository(session), client).sync_prices(
            state=args.state, commodity=args.commodity, max_records=args.max_records
        )
    if sync is None or not sync.succeeded:
        print(f"Sync FAILED: {sync.error if sync else 'not configured'}")
        return 1
    print(f"Sync OK: {sync.records_upserted} row(s) upserted.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--state", help="Only this state, e.g. Maharashtra")
    parser.add_argument("--commodity", help="Only this Agmarknet commodity, e.g. Onion")
    parser.add_argument("--max-records", type=int, default=MAX_RECORDS_PER_SYNC)
    parser.add_argument("--page-size", type=int, default=500)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    sys.exit(asyncio.run(main(parser.parse_args())))
