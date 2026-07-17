from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel

from datetime import datetime, timezone, timedelta
from database import get_session
from models import MapObstacle, Employee, RobotStatus
from auth import verify_api_key

router = APIRouter(prefix="/map", tags=["map"], dependencies=[Depends(verify_api_key)])


# --- Obstacole ---

class ObstacleCreate(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class ObstacleRead(BaseModel):
    id: int
    x1: float
    y1: float
    x2: float
    y2: float
    detected_at: str


@router.post("/obstacles", response_model=ObstacleRead)
def add_obstacle(data: ObstacleCreate, session: Session = Depends(get_session)):
    """Apelat de robot (prin ESP32) când senzorii detectează un obiect în cale."""
    obstacle = MapObstacle(x1=data.x1, y1=data.y1, x2=data.x2, y2=data.y2)
    session.add(obstacle)
    session.commit()
    session.refresh(obstacle)
    return ObstacleRead(
        id=obstacle.id, x1=obstacle.x1, y1=obstacle.y1,
        x2=obstacle.x2, y2=obstacle.y2,
        detected_at=obstacle.detected_at.isoformat(),
    )


@router.get("/obstacles", response_model=List[ObstacleRead])
def list_obstacles(session: Session = Depends(get_session)):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    statement = select(MapObstacle).where(MapObstacle.detected_at >= cutoff)
    obstacles = session.exec(statement).all()
    return [
        ObstacleRead(
            id=o.id, x1=o.x1, y1=o.y1, x2=o.x2, y2=o.y2,
            detected_at=o.detected_at.isoformat(),
        )
        for o in obstacles
    ]


@router.delete("/obstacles")
def clear_obstacles(session: Session = Depends(get_session)):
    """Șterge toate obstacolele — util când robotul reface harta de la zero."""
    obstacles = session.exec(select(MapObstacle)).all()
    for o in obstacles:
        session.delete(o)
    session.commit()
    return {"message": f"{len(obstacles)} obstacole șterse"}


# --- Snapshot complet pentru randarea hărții ---

class StationPoint(BaseModel):
    name: str
    station_id: str
    x: Optional[float]
    y: Optional[float]


class RobotPoint(BaseModel):
    x: Optional[float]
    y: Optional[float]
    heading: Optional[float]
    is_moving: bool


class MapSnapshot(BaseModel):
    stations: List[StationPoint]
    robot: Optional[RobotPoint]
    obstacles: List[ObstacleRead]


@router.get("/full", response_model=MapSnapshot)
def get_map_snapshot(session: Session = Depends(get_session)):
    employees = session.exec(select(Employee)).all()
    stations = [
        StationPoint(name=e.name, station_id=e.station_id, x=e.x, y=e.y)
        for e in employees
    ]

    robot_status = session.exec(select(RobotStatus)).first()
    robot = None
    if robot_status:
        robot = RobotPoint(
            x=robot_status.x, y=robot_status.y,
            heading=robot_status.heading, is_moving=robot_status.is_moving,
        )

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)  # ← nou
    statement = select(MapObstacle).where(MapObstacle.detected_at >= cutoff)  # ← nou
    obstacles = session.exec(statement).all()
    obstacles_read = [
        ObstacleRead(
            id=o.id, x1=o.x1, y1=o.y1, x2=o.x2, y2=o.y2,
            detected_at=o.detected_at.isoformat(),
        )
        for o in obstacles
    ]

    return MapSnapshot(stations=stations, robot=robot, obstacles=obstacles_read)

@router.delete("/obstacles/expired")
def delete_expired_obstacles(session: Session = Depends(get_session)):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    statement = select(MapObstacle).where(MapObstacle.detected_at < cutoff)
    expired = session.exec(statement).all()
    for o in expired:
        session.delete(o)
    session.commit()
    return {"message": f"{len(expired)} obstacole expirate șterse"}