from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional, List
from pydantic import BaseModel

from database import get_session
from models import Notification
from auth import verify_api_key

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(verify_api_key)])


class NotificationCreate(BaseModel):
    recipient_email: str
    sender_email: Optional[str] = None
    message: Optional[str] = None


class NotificationUpdate(BaseModel):
    status: str  # ex: "read", "dismissed"


class NotificationRead(BaseModel):
    id: int
    recipient_email: str
    sender_email: Optional[str] = None
    message: Optional[str] = None
    status: str
    created_at: str


@router.get("/{email}", response_model=List[NotificationRead])
def get_user_notifications(email: str, session: Session = Depends(get_session)):
    notifications = session.exec(
        select(Notification).where(Notification.recipient_email == email)
    ).all()
    
    return [
        NotificationRead(
            id=n.id,
            recipient_email=n.recipient_email,
            sender_email=n.sender_email,
            message=n.message,
            status=n.status,
            created_at=n.created_at.isoformat(),
        ) for n in notifications
    ]


@router.post("/", response_model=NotificationRead)
def create_notification(data: NotificationCreate, session: Session = Depends(get_session)):
    notification = Notification(
        recipient_email=data.recipient_email,
        sender_email=data.sender_email,
        message=data.message,
        status="pending"
    )
    
    session.add(notification)
    session.commit()
    session.refresh(notification)

    return NotificationRead(
        id=notification.id,
        recipient_email=notification.recipient_email,
        sender_email=notification.sender_email,
        message=notification.message,
        status=notification.status,
        created_at=notification.created_at.isoformat(),
    )


@router.patch("/{notification_id}", response_model=NotificationRead)
def update_notification_status(
    notification_id: int, 
    data: NotificationUpdate, 
    session: Session = Depends(get_session)
):
    notification = session.get(Notification, notification_id)

    if not notification:
        raise HTTPException(status_code=404, detail="Notificare inexistentă")

    notification.status = data.status
    
    session.add(notification)
    session.commit()
    session.refresh(notification)

    return NotificationRead(
        id=notification.id,
        recipient_email=notification.recipient_email,
        sender_email=notification.sender_email,
        message=notification.message,
        status=notification.status,
        created_at=notification.created_at.isoformat(),
    )