import uuid
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

# JSONB on Postgres (indexable, efficient); falls back to plain JSON on any
# other dialect — needed so the test suite's in-memory SQLite DB can create
# this table too (SQLite has no JSONB type).
JsonVariant = JSON().with_variant(JSONB(), "postgresql")

from app.models.base import Base


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    crop: Mapped[str] = mapped_column(String(100), nullable=False)
    variety: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sowing_date: Mapped[date] = mapped_column(Date, nullable=False)
    irrigation_method: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # GeoJSON Polygon (EPSG:4326 — lng/lat) exactly as drawn on the map.
    polygon_geojson: Mapped[dict] = mapped_column(JsonVariant, nullable=False)

    # Always server-computed from polygon_geojson (see FarmService) — never
    # trust an area/centroid value sent by the client.
    area_ha: Mapped[float] = mapped_column(Float, nullable=False)
    centroid_lat: Mapped[float] = mapped_column(Float, nullable=False)
    centroid_lng: Mapped[float] = mapped_column(Float, nullable=False)

    state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
