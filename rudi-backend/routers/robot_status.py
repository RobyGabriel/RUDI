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


class RobotStatusRead(BaseModel):
    battery: Optional[int] = None
    current_station: Optional[str] = None
    is_moving: bool
    x: Optional[float] = None       
    y: Optional[float] = None       
    heading: Optional[float] = None 
    last_updated: str


@router.get("/status", response_model=RobotStatusRead)
def get_robot_status(session: Session = Depends(get_session)):
    status = session.exec(select(RobotStatus)).first()
    if not status:
        raise HTTPException(status_code=404, detail="Nicio informație de status disponibilă încă")
    return RobotStatusRead(
        battery=status.battery,
        current_station=status.current_station,
        is_moving=status.is_moving,
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

    from datetime import datetime, timezone
    status.last_updated = datetime.now(timezone.utc)

    session.add(status)
    session.commit()
    session.refresh(status)

    return RobotStatusRead(
        battery=status.battery,
        current_station=status.current_station,
        is_moving=status.is_moving,
        last_updated=status.last_updated.isoformat(),
    )