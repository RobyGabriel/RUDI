from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from database import get_session
from models import RobotStatus
from auth import verify_api_key

router = APIRouter(prefix="/robot", tags=["robot"], dependencies=[Depends(verify_api_key)])


class RobotStatusUpdate(BaseModel):
    battery: Optional[int] = None
    current_station: Optional[str] = None
    is_moving: Optional[bool] = None
    x: Optional[float] = None        
    y: Optional[float] = None        
    heading: Optional[float] = None  
    
    delivery_status: Optional[str] = None
    sender_id: Optional[str] = None
    recipient_id: Optional[str] = None
    sender_data: Optional[str] = None
    recipient_data: Optional[str] = None


class RobotStatusRead(BaseModel):
    battery: Optional[int] = None
    current_station: Optional[str] = None
    is_moving: bool
    x: Optional[float] = None
    y: Optional[float] = None
    heading: Optional[float] = None
    
    delivery_status: str
    sender_id: Optional[str] = None
    recipient_id: Optional[str] = None
    sender_data: Optional[str] = None
    recipient_data: Optional[str] = None
    
    last_updated: str


@router.get("/status", response_model=RobotStatusRead)
def get_robot_status(session: Session = Depends(get_session)):
    from datetime import datetime, timezone
    status = session.exec(select(RobotStatus)).first()
    if not status:
        # BUG FIX: În loc de 404, cream automat un rand default 'idle'
        # Aplicatia mobila sondheaza la fiecare 5s — un 404 repetat rupea starea.
        status = RobotStatus(
            battery=None,
            is_moving=False,
            delivery_status='idle',
            last_updated=datetime.now(timezone.utc),
        )
        session.add(status)
        session.commit()
        session.refresh(status)
    return RobotStatusRead(
        battery=status.battery,
        current_station=status.current_station,
        is_moving=status.is_moving,
        x=status.x,
        y=status.y,
        heading=status.heading,
        delivery_status=status.delivery_status,
        sender_id=status.sender_id,
        recipient_id=status.recipient_id,
        sender_data=status.sender_data,
        recipient_data=status.recipient_data,
        last_updated=status.last_updated.isoformat(),
    )


@router.post("/status", response_model=RobotStatusRead)
def update_robot_status(data: RobotStatusUpdate, session: Session = Depends(get_session)):
    status = session.exec(select(RobotStatus)).first()

    if not status:
        status = RobotStatus()  # prima actualizare — creează înregistrarea

    if data.battery is not None:
        status.battery = data.battery
    if data.current_station is not None:
        status.current_station = data.current_station
    if data.is_moving is not None:
        status.is_moving = data.is_moving
    if data.x is not None:
        status.x = data.x
    if data.y is not None:
        status.y = data.y
    if data.heading is not None:
        status.heading = data.heading
        
    if data.delivery_status is not None:
        status.delivery_status = data.delivery_status
        # Reset delivery data if going idle
        if data.delivery_status == 'idle':
            status.sender_id = None
            status.recipient_id = None
            status.sender_data = None
            status.recipient_data = None
            
    if data.sender_id is not None:
        status.sender_id = data.sender_id
    if data.recipient_id is not None:
        status.recipient_id = data.recipient_id
    if data.sender_data is not None:
        status.sender_data = data.sender_data
    if data.recipient_data is not None:
        status.recipient_data = data.recipient_data

    from datetime import datetime, timezone
    status.last_updated = datetime.now(timezone.utc)

    session.add(status)
    session.commit()
    session.refresh(status)

    return RobotStatusRead(
        battery=status.battery,
        current_station=status.current_station,
        is_moving=status.is_moving,
        x=status.x,
        y=status.y,
        heading=status.heading,
        delivery_status=status.delivery_status,
        sender_id=status.sender_id,
        recipient_id=status.recipient_id,
        sender_data=status.sender_data,
        recipient_data=status.recipient_data,
        last_updated=status.last_updated.isoformat(),
    )