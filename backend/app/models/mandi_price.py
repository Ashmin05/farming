import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, Index, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MandiPrice(Base):
    """One day's price report for one (market, commodity, variety) from
    Agmarknet via data.gov.in (app/integrations/agmarknet_client.py). Upserted
    by the nightly sync job, so re-syncing the same day updates rows in place
    instead of duplicating them. Prices are Rs/quintal."""

    __tablename__ = "mandi_prices"
    __table_args__ = (
        UniqueConstraint("market", "commodity", "variety", "arrival_date", name="uq_mandi_prices_market_cmdt_var_date"),
        Index("ix_mandi_prices_commodity_state_date", "commodity", "state", "arrival_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    market: Mapped[str] = mapped_column(String(150), nullable=False)
    commodity: Mapped[str] = mapped_column(String(150), nullable=False)
    variety: Mapped[str] = mapped_column(String(150), nullable=False)
    grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    arrival_date: Mapped[date] = mapped_column(Date, nullable=False)
    min_price: Mapped[float] = mapped_column(Float, nullable=False)
    max_price: Mapped[float] = mapped_column(Float, nullable=False)
    modal_price: Mapped[float] = mapped_column(Float, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class MandiPriceSync(Base):
    """One run of the mandi price sync (nightly job or manual script). The
    most recent run decides whether price responses are tagged is_live:
    if it failed, the API keeps serving the last stored day, marked stale."""

    __tablename__ = "mandi_price_syncs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    succeeded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    records_upserted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
