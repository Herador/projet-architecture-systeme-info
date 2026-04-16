from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import or_
from typing import List
from uuid import UUID

from shared.database import get_db
from shared.models import Conversation, Message, Property, User
from . import schemas

router = APIRouter(prefix="/interactions", tags=["Interactions"])


# 1. Créer une nouvelle conversation
@router.post("/conversations", response_model=schemas.ConversationRead)
def create_conversation(conv_data: schemas.ConversationCreate, db: Session = Depends(get_db)):
    # Optionnel : vérifier si une conversation existe déjà pour ce trio
    existing = db.query(Conversation).filter(
        Conversation.property_id == conv_data.property_id,
        Conversation.tenant_id == conv_data.tenant_id,
        Conversation.owner_id == conv_data.owner_id
    ).first()

    if existing:
        return existing

    new_conv = Conversation(
        property_id=conv_data.property_id,
        tenant_id=conv_data.tenant_id,
        owner_id=conv_data.owner_id
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv


# 2. Récupérer toutes les conversations d'un utilisateur (Owner ou Tenant)
@router.get("/user/{user_id}/conversations", response_model=List[schemas.ConversationRead])
def get_user_conversations(user_id: UUID, db: Session = Depends(get_db)):
    # On crée des alias pour la table User car on doit joindre deux fois (owner et tenant)
    OwnerUser = aliased(User)
    TenantUser = aliased(User)

    results = db.query(
        Conversation,
        Property.title.label("property_title"),
        OwnerUser.username.label("owner_username"),
        TenantUser.username.label("tenant_username")
    ).join(Property, Conversation.property_id == Property.id) \
     .join(OwnerUser, Conversation.owner_id == OwnerUser.id) \
     .join(TenantUser, Conversation.tenant_id == TenantUser.id) \
     .filter(or_(Conversation.tenant_id == user_id, Conversation.owner_id == user_id)) \
     .all()

    # On transforme le résultat pour remplir les champs du schema
    enriched_conversations = []
    for conv, prop_title, owner_un, tenant_un in results:
        conv.property_title = prop_title
        conv.owner_username = owner_un
        conv.tenant_username = tenant_un
        enriched_conversations.append(conv)

    return enriched_conversations


# 3. Ajouter un message à une conversation existante
@router.post("/conversations/{conversation_id}/messages", response_model=schemas.MessageRead)
def add_message(conversation_id: UUID, msg_data: schemas.MessageCreate, db: Session = Depends(get_db)):
    # Vérifier si la conversation existe
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    new_msg = Message(
        conversation_id=conversation_id,
        sender_id=msg_data.sender_id,
        content=msg_data.content,
        is_read=False
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return new_msg


# 4. Récupérer les n derniers messages d'une conversation
@router.get("/conversations/{conversation_id}/messages", response_model=List[schemas.MessageRead])
def get_conversation_messages(
        conversation_id: UUID,
        limit: int = Query(50, gt=0),
        db: Session = Depends(get_db)
):
    messages = db.query(Message) \
        .filter(Message.conversation_id == conversation_id) \
        .order_by(Message.created_at.desc()) \
        .limit(limit) \
        .all()

    # On les remet dans l'ordre chronologique (du plus vieux au plus récent)
    return messages[::-1]