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
            
            # --- INTEGRARE CU ESP32 ---
            # Trimitem comanda către robot pe IP-ul lui din rețeaua locală
            msg_type = data.get("type")
            if msg_type in ["call_robot", "start_delivery", "go_idle"]:
                import urllib.request
                import threading
                
                def trigger_esp():
                    try:
                        print(f"Trimit HTTP către ESP32 pentru comanda: {msg_type}")
                        # IP-ul ESP32-ului (Thecon Guest)
                        urllib.request.urlopen("http://192.168.0.19/led/toggle", timeout=2)
                    except Exception as e:
                        print("Eroare comunicare cu ESP32:", e)
                
                # Rulăm într-un thread separat ca să nu blocăm serverul WebSocket
                threading.Thread(target=trigger_esp).start()
            # ---------------------------

            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Conexiune închisă")