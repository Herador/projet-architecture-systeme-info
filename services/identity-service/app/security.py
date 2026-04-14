from fastapi import Depends, HTTPException, Request
import httpx

async def get_current_user(request: Request):
    authorization: str = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing or invalid")
    
    token = authorization.split("Bearer ")[1]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://identity-service/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
    
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return response.json()

async def verify_no_connection(request: Request):
    authorization: str = request.headers.get("Authorization")
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1]

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://identity-service/auth/me",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        if response.status_code == 200:
            raise HTTPException(status_code=403, detail="User is already connected")
    return None