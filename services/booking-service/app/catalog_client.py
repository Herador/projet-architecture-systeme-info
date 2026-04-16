import os
from datetime import date
from uuid import UUID

import httpx


CATALOG_SERVICE_URL = os.getenv("CATALOG_SERVICE_URL", "http://catalog-service:8000")
CATALOG_TIMEOUT = httpx.Timeout(5.0, connect=2.0)


async def fetch_property(property_id: UUID) -> dict | None:
    async with httpx.AsyncClient(timeout=CATALOG_TIMEOUT) as client:
        response = await client.get(f"{CATALOG_SERVICE_URL}/catalog/properties/{property_id}")
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()


async def list_published_properties() -> list[dict]:
    async with httpx.AsyncClient(timeout=CATALOG_TIMEOUT) as client:
        response = await client.get(f"{CATALOG_SERVICE_URL}/catalog/properties")
        response.raise_for_status()
        return response.json()


async def list_blocked_dates(property_id: UUID, start: date, end: date) -> set[date]:
    async with httpx.AsyncClient(timeout=CATALOG_TIMEOUT) as client:
        response = await client.get(f"{CATALOG_SERVICE_URL}/catalog/properties/{property_id}/availability")
        if response.status_code == 404:
            return set()
        response.raise_for_status()
        entries = response.json()

    blocked_dates: set[date] = set()
    for entry in entries:
        if not entry.get("is_blocked"):
            continue

        raw_date = entry.get("date")
        if not raw_date:
            continue

        current = date.fromisoformat(str(raw_date).split("T")[0])
        if start <= current < end:
            blocked_dates.add(current)

    return blocked_dates
