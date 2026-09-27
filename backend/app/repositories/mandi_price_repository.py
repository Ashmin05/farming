import uuid
from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.agmarknet_client import MandiPriceRecord
from app.models.mandi_price import MandiPrice, MandiPriceSync

UPSERT_KEY = ("market", "commodity", "variety", "arrival_date")
# Rows per INSERT statement -- keeps well under Postgres's bind-parameter limit.
UPSERT_CHUNK_SIZE = 1000


class MandiPriceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert_many(self, records: Iterable[MandiPriceRecord]) -> int:
        """Inserts new rows and updates existing ones on the
        (market, commodity, variety, arrival_date) key. Returns the number of
        distinct rows written. Duplicates within `records` (Agmarknet can
        report the same key twice, e.g. under two grades) are collapsed to
        the last one first -- Postgres rejects an ON CONFLICT statement that
        would touch the same row twice."""
        by_key: dict[tuple, MandiPriceRecord] = {}
        for record in records:
            by_key[(record.market, record.commodity, record.variety, record.arrival_date)] = record
        if not by_key:
            return 0

        now = datetime.now(timezone.utc)
        rows = [
            {
                "state": r.state,
                "district": r.district,
                "market": r.market,
                "commodity": r.commodity,
                "variety": r.variety,
                "grade": r.grade,
                "arrival_date": r.arrival_date,
                "min_price": r.min_price,
                "max_price": r.max_price,
                "modal_price": r.modal_price,
                "fetched_at": now,
            }
            for r in by_key.values()
        ]

        insert = pg_insert if self.session.bind.dialect.name == "postgresql" else sqlite_insert
        for start in range(0, len(rows), UPSERT_CHUNK_SIZE):
            chunk = rows[start : start + UPSERT_CHUNK_SIZE]
            # MandiPrice.id's default is Python-side, so a bulk insert needs it explicitly.
            for row in chunk:
                row.setdefault("id", uuid.uuid4())
            stmt = insert(MandiPrice).values(chunk)
            stmt = stmt.on_conflict_do_update(
                index_elements=list(UPSERT_KEY),
                set_={
                    col: getattr(stmt.excluded, col)
                    for col in ("state", "district", "grade", "min_price", "max_price", "modal_price", "fetched_at")
                },
            )
            await self.session.execute(stmt)
        await self.session.commit()
        return len(rows)

    async def latest_prices(
        self,
        commodities: list[str],
        *,
        state: str | None = None,
        district: str | None = None,
        lookback_days: int = 7,
    ) -> list[MandiPrice]:
        """The most recent report per (market, commodity, variety) for any of
        `commodities`, within `lookback_days` of the newest matching report --
        mandis report on different days, so "latest" is per market, not one
        global date. Matching is case-insensitive. Sorted by district,
        market, commodity, variety."""
        filters = [func.lower(MandiPrice.commodity).in_([c.lower() for c in commodities])]
        if state:
            filters.append(func.lower(MandiPrice.state) == state.lower())
        if district:
            filters.append(func.lower(MandiPrice.district) == district.lower())

        newest: date | None = await self.session.scalar(select(func.max(MandiPrice.arrival_date)).where(*filters))
        if newest is None:
            return []

        result = await self.session.execute(
            select(MandiPrice)
            .where(*filters, MandiPrice.arrival_date >= newest - timedelta(days=lookback_days))
            .order_by(MandiPrice.arrival_date.desc())
        )
        latest: dict[tuple, MandiPrice] = {}
        for row in result.scalars():
            latest.setdefault((row.market, row.commodity, row.variety), row)  # first seen = newest
        return sorted(latest.values(), key=lambda r: (r.district, r.market, r.commodity, r.variety))

    async def start_sync(self) -> MandiPriceSync:
        sync = MandiPriceSync(started_at=datetime.now(timezone.utc))
        self.session.add(sync)
        await self.session.commit()
        await self.session.refresh(sync)
        return sync

    async def finish_sync(
        self, sync: MandiPriceSync, *, succeeded: bool, records_upserted: int = 0, error: str | None = None
    ) -> MandiPriceSync:
        sync.finished_at = datetime.now(timezone.utc)
        sync.succeeded = succeeded
        sync.records_upserted = records_upserted
        sync.error = error[:2000] if error else None
        await self.session.commit()
        await self.session.refresh(sync)
        return sync

    async def latest_finished_sync(self) -> MandiPriceSync | None:
        result = await self.session.execute(
            select(MandiPriceSync)
            .where(MandiPriceSync.finished_at.is_not(None))
            .order_by(MandiPriceSync.started_at.desc())
            .limit(1)
        )
        return result.scalars().first()
