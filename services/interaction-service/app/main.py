from fastapi import FastAPI
from app.routes import router
from shared.database import engine
from shared.models import Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Interaction Service", redirect_slashes=False)
app.include_router(router)

@app.get("/")
def health_check():
    return {"status": "interaction service is running"}