import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
from sqlmodel import Session

from database import engine
from models import CommandLog
from esp32_client import send_to_esp32

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_json(self, message: dict):
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.active_connections.remove(d)
            
    async def broadcast_text(self, text: str):
        dead = []
        for connection in self.active_connections:
            try:
                await connection.send_text(text)
            except Exception:
                dead.append(connection)
        for d in dead:
            self.active_connections.remove(d)


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
            # Citim text brut pentru a nu crăpa la mesaje STM32
            raw_text = await websocket.receive_text()
            print(f"Mesaj WS primit: {raw_text}")
            
            # Încercăm să parsăm JSON (dacă vine de la Aplicație)
            try:
                data = json.loads(raw_text)
                
                # Este JSON valid venit de la Aplicație
                msg_type = data.get("type")
                
                # Traducem pentru ESP32 (via Serial) și facem broadcast text
                # Mapare completă conform codului C++ al ESP32:
                # Mapare completă tip WS → caracter serial ESP32
                # conform codului C++ din rudi-sim-obstacol/esp32-bridge
                ESP32_MAP = {
                    "emergency_stop":   "X",    # stopMotors() imediat
                    "call_robot":       "DEMO", # misiunea completă ghidată
                    "start_delivery":   "DEMO", # misiunea completă ghidată
                    "test_motors":      "T",    # runTest() — test scurt motoare
                    "motor1_diag":      "1",    # runMotor1Diagnostic()
                    "motor2_diag":      "2",    # runMotor2Diagnostic()
                    "motor1_forward":   "F",    # Motor1 forward 99% / 10s
                    "motor1_backward":  "B",    # Motor1 backward 99% / 10s
                    "motor2_forward":   "3",    # Motor2 forward 99% / 10s
                    "motor2_backward":  "4",    # Motor2 backward 99% / 10s
                    "motor1_reverse":   "R",    # runMotor1ReverseTest()
                    "dir1_low":         "L",    # DIR1 = LOW
                    "dir1_high":        "H",    # DIR1 = HIGH
                    "request_status":   "S",    # cerere status
                }

                serial_cmd = ESP32_MAP.get(msg_type)
                if serial_cmd:
                    asyncio.create_task(send_to_esp32(serial_cmd))

                # Salvăm în log doar evenimentele de livrare relevante
                LOGGABLE_EVENTS = {'call_robot', 'start_delivery', 'delivery_confirmed', 'confirm_delivery'}
                if msg_type in LOGGABLE_EVENTS:
                    save_log(data)

                # Broadcast JSON pentru sincronizarea tabletelor (App -> App)
                await manager.broadcast_json(data)

            except json.JSONDecodeError:
                # Daca din greseala vine un mesaj invalid, il ignoram
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Conexiune închisă")