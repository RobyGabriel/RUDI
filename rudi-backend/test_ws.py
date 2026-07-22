from database import engine
from sqlmodel import Session, select
from models import CommandLog, RobotStatus
import json

data = {
    "type": "call_robot",
    "sender_id": "1",
    "sender": {"id": "1", "name": "Ionut"}
}

requested_by = data.get("sender_id") or (data.get("from_user", {}).get("id"))
print("Requested by:", requested_by)
