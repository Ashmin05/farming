"""Mandi price schema: a normalised catalogue (states -> districts -> markets,
commodities -> varieties, grades) plus the price reports themselves and the
bookkeeping of every ingestion run.

Catalogue rows carry the source id as `external_id` (Agmarknet 2.0's ids --
the primary source). Rows learnt only from a fallback source (CEDA/data.gov.in)
have external_id NULL and are matched by `name_key`.
"""

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    BigInteger,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# BIGINT identity on Postgres; SQLite (tests) only autoincrements INTEGER PKs.
BigId = BigInteger().with_variant(Integer, "sqlite")
JsonVariant = JSON().with_variant(JSONB(), "postgresql")
# Money: exact decimals, never floats or strings. Rs/quintal to the paisa.
Price = Numeric(12, 2)
Quantity = Numeric(14, 3)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MarketState(Base):
    __tablename__ = "states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class MarketDistrict(Base):
    __tablename__ = "districts"
    __table_args__ = (UniqueConstraint("state_id", "name_key", name="uq_districts_state_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_key: Mapped[str] = mapped_column(String(100), nullable=False)


class Market(Base):
    __tablename__ = "markets"
    # Not unique: Agmarknet has a few same-named markets in different
    # districts of one state (e.g. two "Ibrahimpatnam APMC" in Telangana).
    __table_args__ = (Index("ix_markets_state_name_key", "state_id", "name_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id", ondelete="CASCADE"), nullable=False, index=True)
    district_id: Mapped[int | None] = mapped_column(
        ForeignKey("districts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_key: Mapped[str] = mapped_column(String(200), nullable=False)
    # No source publishes market coordinates. These stay NULL unless filled
    # from a named source (coordinate_source says which, and how precise).
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    coordinate_source: Mapped[str | None] = mapped_column(String(100), nullable=True)


class Commodity(Base):
    __tablename__ = "commodities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    # Not unique: Agmarknet lists "Kutki" under two ids.
    name_key: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    commodity_group: Mapped[str | None] = mapped_column(String(100), nullable=True)


class Variety(Base):
    __tablename__ = "varieties"
    __table_args__ = (UniqueConstraint("commodity_id", "name_key", name="uq_varieties_commodity_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Agmarknet variety ids are shared across commodities, so not unique here.
    external_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    commodity_id: Mapped[int] = mapped_column(
        ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    name_key: Mapped[str] = mapped_column(String(150), nullable=False)


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class MarketPrice(Base):
    """One market's report for one commodity (+ variety/grade when the
    source gives them) on one day. Idempotency key: (source,
    source_record_id) -- re-ingesting the same report updates this row."""

    __tablename__ = "market_prices"
    __table_args__ = (
        UniqueConstraint("source", "source_record_id", name="uq_market_prices_source_record"),
        Index("ix_market_prices_market_commodity_date", "market_id", "commodity_id", "arrival_date"),
        Index("ix_market_prices_commodity_date", "commodity_id", "arrival_date"),
        Index("ix_market_prices_state_commodity_date", "state_id", "commodity_id", "arrival_date"),
    )

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id", ondelete="CASCADE"), nullable=False, index=True)
    # Denormalised from the market so state-level queries don't need a join.
    state_id: Mapped[int] = mapped_column(ForeignKey("states.id", ondelete="CASCADE"), nullable=False)
    commodity_id: Mapped[int] = mapped_column(
        ForeignKey("commodities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variety_id: Mapped[int | None] = mapped_column(ForeignKey("varieties.id", ondelete="SET NULL"), nullable=True)
    grade_id: Mapped[int | None] = mapped_column(ForeignKey("grades.id", ondelete="SET NULL"), nullable=True)
    arrival_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    min_price: Mapped[Decimal | None] = mapped_column(Price, nullable=True)
    max_price: Mapped[Decimal | None] = mapped_column(Price, nullable=True)
    modal_price: Mapped[Decimal] = mapped_column(Price, nullable=False)
    arrival_quantity: Mapped[Decimal | None] = mapped_column(Quantity, nullable=True)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)  # price unit, always Rs/quintal
    arrival_unit: Mapped[str | None] = mapped_column(String(32), nullable=True)

    source: Mapped[str] = mapped_column(String(32), nullable=False)
    source_record_id: Mapped[str] = mapped_column(String(255), nullable=False)
    # Validation findings that didn't warrant rejection (e.g. "price_order").
    quality_flags: Mapped[list] = mapped_column(JsonVariant, nullable=False, default=list)

    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class PriceIngestionRun(Base):
    """One ingestion invocation (catalogue sync, current prices or a
    backfill slice) with the statistics the logs report."""

    __tablename__ = "price_ingestion_runs"

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # catalog | current | backfill
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    params: Mapped[dict] = mapped_column(JsonVariant, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requests_made: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_fetched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_inserted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_rejected: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_flagged: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[list] = mapped_column(JsonVariant, nullable=False, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class PriceQualityIssue(Base):
    """A rejected or flagged record, with the source row kept verbatim --
    records are never silently fixed."""

    __tablename__ = "price_quality_issues"
    __table_args__ = (Index("ix_price_quality_issues_code", "code"),)

    id: Mapped[int] = mapped_column(BigId, primary_key=True)
    run_id: Mapped[int | None] = mapped_column(
        ForeignKey("price_ingestion_runs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    severity: Mapped[str] = mapped_column(String(10), nullable=False)  # rejected | flagged
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    source_record_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw: Mapped[dict | None] = mapped_column(JsonVariant, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
