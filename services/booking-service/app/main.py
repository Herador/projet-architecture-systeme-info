from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.events import close_connection


@asynccontextmanager
async def lifespan(application: FastAPI):
    yield
    await close_connection()


app = FastAPI(title="Booking Service", lifespan=lifespan)

from app.routes import router  # noqa: E402
app.include_router(router)
