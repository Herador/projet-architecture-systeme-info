from fastapi import FastAPI
from app.routes import router
from shared.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Search Service")
app.include_router(router)