from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.integrations.earth_engine_client import earth_engine_client
from app.routers import auth, farms, health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Never raises — an unconfigured or invalid Earth Engine key must not
    # stop the rest of the API from starting. See EarthEngineClient.initialize.
    earth_engine_client.initialize()
    yield


app = FastAPI(title="FasalSetu API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(farms.router)
