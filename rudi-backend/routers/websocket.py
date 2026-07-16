from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
from sqlmodel import Session

from database import engine
from models import CommandLog

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)


manager = ConnectionManager()


def save_log(data: dict):
    with Session(engine) as session:
        log_entry = CommandLog(
            requested_by=data.get("requested_by"),
            target_employee=data.get("target_employee"),
            station_id=data.get("station_id"),
            status=data.get("status"),
        )
        session.add(log_entry)
        session.commit()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            print("Mesaj primit:", data)
            save_log(data)
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Conexiune închisă")