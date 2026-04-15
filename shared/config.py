from typing import TypedDict


class BookingStatus(TypedDict):
    value: str
    label: str
    label_en: str


class UserRole(TypedDict):
    value: str
    label: str


class PropertyStatus(TypedDict):
    value: str
    label: str


class StatusTransition(TypedDict):
    from_status: str
    to_statuses: list[str]


BOOKING_STATUSES: list[BookingStatus] = [
    {"value": "pending", "label": "En attente", "label_en": "Pending"},
    {"value": "accepted", "label": "Acceptée", "label_en": "Accepted"},
    {"value": "refused", "label": "Refusée", "label_en": "Refused"},
    {"value": "paid", "label": "Payée", "label_en": "Paid"},
    {"value": "cancelled", "label": "Annulée", "label_en": "Cancelled"},
]

BOOKING_STATUS_VALUES: list[str] = [s["value"] for s in BOOKING_STATUSES]
BOOKING_STATUS_LABELS: dict[str, str] = {s["value"]: s["label"] for s in BOOKING_STATUSES}
BOOKING_STATUS_LABELS_EN: dict[str, str] = {s["value"]: s["label_en"] for s in BOOKING_STATUSES}

USER_ROLES: list[UserRole] = [
    {"value": "tenant", "label": "Locataire"},
    {"value": "owner", "label": "Propriétaire"},
    {"value": "admin", "label": "Administrateur"},
]

USER_ROLE_VALUES: list[str] = [r["value"] for r in USER_ROLES]
USER_ROLE_LABELS: dict[str, str] = {r["value"]: r["label"] for r in USER_ROLES}

PROPERTY_STATUSES: list[PropertyStatus] = [
    {"value": "draft", "label": "Brouillon"},
    {"value": "published", "label": "Publiée"},
    {"value": "archived", "label": "Archivée"},
]

PROPERTY_STATUS_VALUES: list[str] = [s["value"] for s in PROPERTY_STATUSES]
PROPERTY_STATUS_LABELS: dict[str, str] = {s["value"]: s["label"] for s in PROPERTY_STATUSES}

STATUS_TRANSITIONS: dict[str, dict[str, list[str]]] = {
    "owner": {
        "pending": ["accepted", "refused"],
    },
    "tenant": {
        "pending": ["cancelled"],
        "accepted": ["paid", "cancelled"],
    },
    "admin": {
        "pending": ["cancelled"],
        "accepted": ["cancelled"],
        "paid": ["cancelled"],
    },
}

REVIEW_TARGET_TYPES = ["property", "user"]

REVIEW_RATING_MIN = 1
REVIEW_RATING_MAX = 5

BOOKABLE_STATUSES = ["pending", "accepted", "paid"]


def get_booking_status_label(status: str, lang: str = "fr") -> str:
    if lang == "en":
        return BOOKING_STATUS_LABELS_EN.get(status, status)
    return BOOKING_STATUS_LABELS.get(status, status)


def is_valid_booking_status(status: str) -> bool:
    return status in BOOKING_STATUS_VALUES


def is_valid_property_status(status: str) -> bool:
    return status in PROPERTY_STATUS_VALUES


def is_valid_user_role(role: str) -> bool:
    return role in USER_ROLE_VALUES


def is_valid_review_target_type(target_type: str) -> bool:
    return target_type in REVIEW_TARGET_TYPES


def can_transition(role: str, from_status: str, to_status: str) -> bool:
    transitions = STATUS_TRANSITIONS.get(role, {})
    return to_status in transitions.get(from_status, [])


def get_available_transitions(role: str, from_status: str) -> list[str]:
    return STATUS_TRANSITIONS.get(role, {}).get(from_status, [])


def build_frontend_config() -> dict:
    return {
        "booking_statuses": BOOKING_STATUSES,
        "user_roles": USER_ROLES,
        "property_statuses": PROPERTY_STATUSES,
        "review_target_types": REVIEW_TARGET_TYPES,
        "review_rating_range": {"min": REVIEW_RATING_MIN, "max": REVIEW_RATING_MAX},
        "status_transitions": STATUS_TRANSITIONS,
    }
