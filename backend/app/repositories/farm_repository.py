import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.farm import Farm


class FarmRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, farm_id: uuid.UUID) -> Farm | None:
        return await self.session.get(Farm, farm_id)

    async def list_by_user(self, user_id: uuid.UUID) -> list[Farm]:
        result = await self.session.execute(
            select(Farm).where(Farm.user_id == user_id).order_by(Farm.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        name: str,
        crop: str,
        variety: str | None,
        sowing_date,
        irrigation_method: str | None,
        polygon_geojson: dict,
        area_ha: float,
        centroid_lat: float,
        centroid_lng: float,
        state: str | None,
        district: str | None,
        address: str | None,
    ) -> Farm:
        farm = Farm(
            user_id=user_id,
            name=name,
            crop=crop,
            variety=variety,
            sowing_date=sowing_date,
            irrigation_method=irrigation_method,
            polygon_geojson=polygon_geojson,
            area_ha=area_ha,
            centroid_lat=centroid_lat,
            centroid_lng=centroid_lng,
            state=state,
            district=district,
            address=address,
        )
        self.session.add(farm)
        await self.session.commit()
        await self.session.refresh(farm)
        return farm

    async def update(self, farm: Farm, **fields) -> Farm:
        for key, value in fields.items():
            if value is not None:
                setattr(farm, key, value)
        await self.session.commit()
        await self.session.refresh(farm)
        return farm

    async def delete(self, farm: Farm) -> None:
        await self.session.delete(farm)
        await self.session.commit()
