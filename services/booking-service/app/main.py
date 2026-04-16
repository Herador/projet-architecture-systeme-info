from fastapi import FastAPI

from shared.database import engine
from shared.models import Base


Base.metadata.create_all(bind=engine)
app = FastAPI(title="Booking Service")

from app.routes import router  # noqa: E402

app.include_router(router)
