import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class FarmCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    crop: str = Field(min_length=1, max_length=100)
    variety: str | None = Field(default=None, max_length=100)
    sowing_date: date
    irrigation_method: str | None = Field(default=None, max_length=100)
    # GeoJSON Polygon geometry, e.g. {"type": "Polygon", "coordinates": [[[lng, lat], ...]]}
    polygon_geojson: dict
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=255)


class FarmUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    crop: str | None = Field(default=None, min_length=1, max_length=100)
    variety: str | None = Field(default=None, max_length=100)
    sowing_date: date | None = None
    irrigation_method: str | None = Field(default=None, max_length=100)
    polygon_geojson: dict | None = None
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=255)


class FarmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    crop: str
    variety: str | None
    sowing_date: date
    irrigation_method: str | None
    polygon_geojson: dict
    area_ha: float
    centroid_lat: float
    centroid_lng: float
    state: str | None
    district: str | None
    address: str | None
    created_at: datetime
    updated_at: datetime
