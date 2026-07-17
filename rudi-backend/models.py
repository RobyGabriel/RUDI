from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, timezone


class Employee(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    station_id: str
    department: Optional[str] = None
    hashed_password: str
    x: Optional[float] = None
    y: Optional[float] = None 
    role: str = Field(default="employee")

class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    recipient_email: str = Field(index=True)     # Who gets the notification
    sender_email: Optional[str] = None           # Who dispatched the robot
    message: Optional[str] = None                # Context (e.g., "Contract delivery")
    status: str = Field(default="pending")       # e.g., "pending", "read", "dismissed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class CommandLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    requested_by: Optional[str] = None      # cine a trimis comanda
    target_employee: Optional[str] = None   # cui i s-a trimis robotul
    station_id: Optional[str] = None        # unde trebuie să ajungă
    status: Optional[str] = None            # ex: "call"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MapObstacle(SQLModel, table=True):
    """Un segment de linie care reprezintă un obstacol detectat de senzori."""
    id: Optional[int] = Field(default=None, primary_key=True)
    x1: float
    y1: float
    x2: float
    y2: float
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RobotStatus(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    battery: Optional[int] = None          # procent, ex: 87
    current_station: Optional[str] = None  # unde se află acum robotul
    is_moving: bool = False
    x: Optional[float] = None        # ← nou: poziția curentă X
    y: Optional[float] = None        # ← nou: poziția curentă Y
    heading: Optional[float] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))