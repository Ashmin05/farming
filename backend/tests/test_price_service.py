"""MandiPriceRepository + PriceService against an in-memory SQLite DB, with
data.gov.in mocked by respx for the sync paths."""

from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest
import respx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from tenacity import wait_none

from app.integrations.agmarknet_client import AgmarknetClient, MandiPriceRecord
from app.jobs import scheduler
from app.models import Base
from app.models.mandi_price import MandiPrice, MandiPriceSync
from app.repositories.mandi_price_repository import MandiPriceRepository
from app.services.price_service import PRICE_SOURCE, PriceService, commodities_for_crop
from tests.test_agmarknet_client import RESOURCE_URL, page, raw_row


def record(**overrides) -> MandiPriceRecord:
    base = MandiPriceRecord(
        state="Maharashtra",
        district="Nashik",
        market="Lasalgaon",
        commodity="Onion",
        variety="Red",
        grade="FAQ",
        arrival_date=date(2026, 9, 25),
        min_price=2000.0,
        max_price=2600.0,
        modal_price=2400.0,
    )
    return replace(base, **overrides)


def farm(**overrides) -> SimpleNamespace:
    return SimpleNamespace(**{"crop": "Onion", "state": "Maharashtra", "district": "Nashik", **overrides})


def mocked_client(**overrides) -> AgmarknetClient:
    return AgmarknetClient("test-key", wait=wait_none(), **overrides)


async def count_rows(repo: MandiPriceRepository) -> int:
    return await repo.session.scalar(select(func.count()).select_from(MandiPrice))


async def record_sync(repo: MandiPriceRepository, *, succeeded: bool, hours_ago: float = 1) -> None:
    sync = await repo.start_sync()
    await repo.finish_sync(sync, succeeded=succeeded, error=None if succeeded else "boom")
    when = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    sync.started_at = sync.finished_at = when
    await repo.session.commit()


class TestUpsert:
    async def test_inserts_then_updates_on_the_unique_key(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])
        await mandi_price_repository.upsert_many([record(modal_price=2550.0, max_price=2700.0)])

        rows = (await mandi_price_repository.session.execute(select(MandiPrice))).scalars().all()
        assert len(rows) == 1
        await mandi_price_repository.session.refresh(rows[0])
        assert rows[0].modal_price == 2550.0
        assert rows[0].max_price == 2700.0

    async def test_distinct_key_parts_make_distinct_rows(self, mandi_price_repository) -> None:
        written = await mandi_price_repository.upsert_many(
            [
                record(),
                record(market="Pimpalgaon"),
                record(variety="White"),
                record(arrival_date=date(2026, 9, 24)),
            ]
        )

        assert written == 4
        assert await count_rows(mandi_price_repository) == 4

    async def test_duplicate_keys_within_one_batch_collapse_to_the_last(self, mandi_price_repository) -> None:
        # Same market/commodity/variety/date reported under two grades.
        written = await mandi_price_repository.upsert_many(
            [record(grade="FAQ", modal_price=2400.0), record(grade="Non-FAQ", modal_price=1800.0)]
        )

        assert written == 1
        row = (await mandi_price_repository.session.execute(select(MandiPrice))).scalars().one()
        assert (row.grade, row.modal_price) == ("Non-FAQ", 1800.0)

    async def test_empty_batch_is_a_no_op(self, mandi_price_repository) -> None:
        assert await mandi_price_repository.upsert_many([]) == 0


class TestLatestPrices:
    async def test_latest_report_per_market_case_insensitive(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many(
            [
                record(arrival_date=date(2026, 9, 24), modal_price=2300.0),
                record(arrival_date=date(2026, 9, 25), modal_price=2400.0),
                # Pimpalgaon last reported two days earlier -- still its latest.
                record(market="Pimpalgaon", arrival_date=date(2026, 9, 23), modal_price=2250.0),
                record(state="Karnataka", district="Bangalore", market="Binny Mill", modal_price=2900.0),
            ]
        )
        service = PriceService(mandi_price_repository)

        quote = await service.latest_prices("onion", state="maharashtra")

        assert [(p.market, p.arrival_date, p.modal_price) for p in quote.prices] == [
            ("Lasalgaon", date(2026, 9, 25), 2400.0),
            ("Pimpalgaon", date(2026, 9, 23), 2250.0),
        ]
        assert quote.provenance.as_of == date(2026, 9, 25)
        assert quote.provenance.source == PRICE_SOURCE

    async def test_ignores_reports_older_than_the_lookback(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many(
            [record(), record(market="Stale Mandi", arrival_date=date(2026, 9, 1))]
        )

        quote = await PriceService(mandi_price_repository).latest_prices("Onion")

        assert [p.market for p in quote.prices] == ["Lasalgaon"]

    async def test_district_filter(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many(
            [record(), record(district="Pune", market="Pune (Moshi)")]
        )

        quote = await PriceService(mandi_price_repository).latest_prices("Onion", district="PUNE")

        assert [p.market for p in quote.prices] == ["Pune (Moshi)"]

    async def test_crop_names_map_to_agmarknet_commodities(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many(
            [record(commodity="Paddy(Dhan)(Common)", variety="Common"), record(commodity="Soyabean")]
        )
        service = PriceService(mandi_price_repository)

        assert [p.commodity for p in (await service.latest_prices("Rice")).prices] == ["Paddy(Dhan)(Common)"]
        assert [p.commodity for p in (await service.latest_prices("Soybean")).prices] == ["Soyabean"]
        assert commodities_for_crop("Onion") == ["Onion"]

    async def test_no_data_returns_empty_with_null_as_of(self, mandi_price_repository) -> None:
        quote = await PriceService(mandi_price_repository).latest_prices("Onion")

        assert quote.prices == []
        assert quote.provenance.as_of is None


class TestNearbyMandis:
    async def test_same_district_first_then_rest_of_state(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many(
            [
                record(district="Ahmednagar", market="Rahuri"),
                record(district="Nashik", market="Lasalgaon"),
                record(district="Nashik", market="Pimpalgaon"),
                record(state="Gujarat", district="Surat", market="Surat"),
            ]
        )

        quote = await PriceService(mandi_price_repository).nearby_mandis(farm(district="nashik"))

        assert [(m.price.market, m.scope) for m in quote.mandis] == [
            ("Lasalgaon", "district"),
            ("Pimpalgaon", "district"),
            ("Rahuri", "state"),
        ]
        assert quote.commodities == ["Onion"]

    async def test_no_district_means_whole_state(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])

        quote = await PriceService(mandi_price_repository).nearby_mandis(farm(district=None))

        assert [m.scope for m in quote.mandis] == ["state"]

    async def test_farm_without_state_gets_nothing(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])

        quote = await PriceService(mandi_price_repository).nearby_mandis(farm(state=None))

        assert quote.mandis == []


class TestProvenance:
    async def test_not_live_before_any_sync(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])

        quote = await PriceService(mandi_price_repository).latest_prices("Onion")

        assert quote.provenance.is_live is False

    async def test_live_after_a_recent_successful_sync(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])
        await record_sync(mandi_price_repository, succeeded=True, hours_ago=2)

        assert (await PriceService(mandi_price_repository).latest_prices("Onion")).provenance.is_live is True

    async def test_failed_latest_sync_serves_last_stored_day_as_not_live(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])
        await record_sync(mandi_price_repository, succeeded=True, hours_ago=26)
        await record_sync(mandi_price_repository, succeeded=False, hours_ago=2)

        quote = await PriceService(mandi_price_repository).latest_prices("Onion")

        assert quote.provenance.is_live is False
        assert [p.market for p in quote.prices] == ["Lasalgaon"]  # still served
        assert quote.provenance.as_of == date(2026, 9, 25)

    async def test_overdue_successful_sync_is_not_live(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])
        await record_sync(mandi_price_repository, succeeded=True, hours_ago=40)

        assert (await PriceService(mandi_price_repository).latest_prices("Onion")).provenance.is_live is False


class TestSyncPrices:
    @respx.mock
    async def test_successful_sync_upserts_and_records_the_run(self, mandi_price_repository) -> None:
        respx.get(RESOURCE_URL).mock(
            return_value=httpx.Response(
                200, json=page([raw_row(), raw_row(market="Pimpalgaon"), raw_row(modal_price="NR")], total=3)
            )
        )
        service = PriceService(mandi_price_repository, mocked_client())

        sync = await service.sync_prices()

        assert sync is not None and sync.succeeded
        assert sync.records_upserted == 2  # the "NR" row was dropped
        assert await count_rows(mandi_price_repository) == 2
        assert (await service.latest_prices("Onion")).provenance.is_live is True

    @respx.mock
    async def test_failed_sync_is_recorded_and_keeps_stored_prices(self, mandi_price_repository) -> None:
        await mandi_price_repository.upsert_many([record()])
        await record_sync(mandi_price_repository, succeeded=True, hours_ago=20)
        respx.get(RESOURCE_URL).mock(return_value=httpx.Response(504, text="Gateway Time-out"))
        service = PriceService(mandi_price_repository, mocked_client(max_attempts=2))

        sync = await service.sync_prices()

        assert sync is not None and not sync.succeeded
        assert "AgmarknetRequestError" in sync.error
        quote = await service.latest_prices("Onion")
        assert [p.market for p in quote.prices] == ["Lasalgaon"]
        assert quote.provenance.is_live is False

    async def test_skips_without_an_api_key(self, mandi_price_repository) -> None:
        service = PriceService(mandi_price_repository, AgmarknetClient(None))

        assert await service.sync_prices() is None
        assert await mandi_price_repository.latest_finished_sync() is None


class TestNightlyJob:
    @pytest.fixture
    async def session_factory(self, monkeypatch):
        engine = create_async_engine("sqlite+aiosqlite://")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        factory = async_sessionmaker(bind=engine, expire_on_commit=False)
        monkeypatch.setattr(scheduler, "AsyncSessionLocal", factory)
        monkeypatch.setattr(scheduler, "agmarknet_client", mocked_client(max_attempts=2))
        yield factory
        await engine.dispose()

    @respx.mock
    async def test_job_syncs_prices(self, session_factory) -> None:
        respx.get(RESOURCE_URL).mock(return_value=httpx.Response(200, json=page([raw_row()], total=1)))

        await scheduler.run_nightly_mandi_price_sync()

        async with session_factory() as session:
            assert await session.scalar(select(func.count()).select_from(MandiPrice)) == 1
            sync = (await session.execute(select(MandiPriceSync))).scalars().one()
            assert sync.succeeded

    @respx.mock
    async def test_job_failure_is_recorded_not_raised(self, session_factory) -> None:
        respx.get(RESOURCE_URL).mock(side_effect=httpx.ConnectError("data.gov.in unreachable"))

        await scheduler.run_nightly_mandi_price_sync()  # must not raise

        async with session_factory() as session:
            sync = (await session.execute(select(MandiPriceSync))).scalars().one()
            assert not sync.succeeded
            assert "unreachable" in sync.error
