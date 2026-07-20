from fastapi import APIRouter, Depends
from typing import Optional, Literal
from pydantic import BaseModel

from auth import verify_api_key

router = APIRouter(prefix="/robot", tags=["commands"], dependencies=[Depends(verify_api_key)])


class RobotCommand(BaseModel):
    action: Literal["start", "stop"]
    speed: Optional[float] = None  # 0-100, only relevant for "start"


class RobotCommandRead(BaseModel):
    action: str
    speed: Optional[float] = None


# Simple in-memory store — one pending command at a time, no history needed yet.
_pending_command: Optional[RobotCommand] = None


@router.post("/command", response_model=RobotCommandRead)
def queue_command(cmd: RobotCommand):
    """Apelat de laptop/backend pentru a trimite o comandă robotului."""
    global _pending_command
    _pending_command = cmd
    print(f"[command queued] {cmd}")
    return cmd


@router.get("/command/next", response_model=RobotCommandRead)
def get_next_command():
    """Apelat de ESP32, periodic, pentru a verifica dacă există o comandă nouă."""
    global _pending_command
    if _pending_command is None:
        return RobotCommandRead(action="none")
    cmd = _pending_command
    _pending_command = None  # one-shot — consumed once read
    print(f"[command delivered] {cmd}")
    return RobotCommandRead(action=cmd.action, speed=cmd.speed)
