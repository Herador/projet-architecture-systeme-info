from typing import TypedDict
from uuid import UUID

from fastapi import Header, HTTPException

from shared.config import USER_ROLE_VALUES, is_valid_user_role


class UserIdentity(TypedDict):
    user_id: UUID
    role: str


def get_user_identity(
    x_user_id: str = Header(...),
    x_user_role: str = Header(...),
) -> UserIdentity:
    try:
        user_id = UUID(x_user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Identifiant utilisateur invalide",
                    "field": "user_id",
                    "retry_possible": True,
                },
            },
        ) from exc

    if not is_valid_user_role(x_user_role):
        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_ROLE",
                    "message": f"Rôle invalide. Valeurs possibles: {', '.join(USER_ROLE_VALUES)}",
                    "field": "role",
                    "retry_possible": True,
                },
            },
        )

    return {"user_id": user_id, "role": x_user_role}
