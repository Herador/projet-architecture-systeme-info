from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import List, Optional

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    sender_id: UUID

class MessageRead(MessageBase):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    is_read: bool
    created_at: datetime
    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    property_id: UUID
    tenant_id: UUID
    owner_id: UUID

class ConversationCreate(ConversationBase):
    pass

class ConversationRead(ConversationBase):
    id: UUID
    created_at: datetime
    property_title: Optional[str] = None
    tenant_username: Optional[str] = None
    owner_username: Optional[str] = None

    class Config:
        from_attributes = True