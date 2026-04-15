from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from app.routes import router
from shared.database import engine
from shared.models import Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Catalog Service")
app.include_router(router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title=app.title, version="1.0.0", routes=app.routes)
    schema.setdefault("components", {})["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer"}
    }
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation["security"] = [{"BearerAuth": []}]
    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi
