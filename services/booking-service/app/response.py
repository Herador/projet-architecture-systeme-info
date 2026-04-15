from datetime import datetime
from enum import Enum
from typing import Any, Generic, TypeVar, Optional
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorCode(str, Enum):
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    CONFLICT = "CONFLICT"
    INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION"
    DATE_UNAVAILABLE = "DATE_UNAVAILABLE"
    BOOKING_OVERLAP = "BOOKING_OVERLAP"
    SELF_BOOKING_NOT_ALLOWED = "SELF_BOOKING_NOT_ALLOWED"
    INVALID_DATES = "INVALID_DATES"
    PAST_DATE_NOT_ALLOWED = "PAST_DATE_NOT_ALLOWED"
    ALREADY_REVIEWED = "ALREADY_REVIEWED"
    REVIEW_ONLY_PAID = "REVIEW_ONLY_PAID"
    CANNOT_CANCEL_PAID = "CANNOT_CANCEL_PAID"
    ALREADY_TERMINAL = "ALREADY_TERMINAL"
    PROPERTY_NOT_AVAILABLE = "PROPERTY_NOT_AVAILABLE"
    INVALID_ROLE = "INVALID_ROLE"
    INVALID_STATUS = "INVALID_STATUS"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorDetail(BaseModel):
    code: ErrorCode
    message: str
    field: Optional[str] = None
    retry_possible: bool = True
    details: Optional[dict] = None


class ActionInfo(BaseModel):
    action: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None
    resource_id: Optional[str] = None


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[ErrorDetail] = None
    action: Optional[ActionInfo] = None
    meta: Optional[dict] = None

    @classmethod
    def ok(cls, data: T, action: Optional[str] = None, meta: Optional[dict] = None) -> "ApiResponse[T]":
        return cls(
            success=True,
            data=data,
            action=ActionInfo(action=action) if action else None,
            meta=meta,
        )

    @classmethod
    def error(
        cls,
        code: ErrorCode,
        message: str,
        field: Optional[str] = None,
        retry_possible: bool = True,
        details: Optional[dict] = None,
    ) -> "ApiResponse[None]":
        return cls(
            success=False,
            error=ErrorDetail(
                code=code,
                message=message,
                field=field,
                retry_possible=retry_possible,
                details=details,
            ),
        )


def error_response(
    code: ErrorCode,
    message: str,
    status_code: int,
    field: Optional[str] = None,
    retry_possible: bool = True,
    details: Optional[dict] = None,
) -> tuple[ApiResponse[None], int]:
    return (
        ApiResponse.error(
            code=code,
            message=message,
            field=field,
            retry_possible=retry_possible,
            details=details,
        ),
        status_code,
    )
