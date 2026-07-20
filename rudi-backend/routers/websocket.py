import json
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
                ESP32_MAP = {
                    "emergency_stop":   "X",  # stopMotors()
                    "test_motors":      "T",  # runTest() — ambele motoare
                    "motor1_diag":      "1",  # runMotor1Diagnostic()
                    "motor2_diag":      "2",  # runMotor2Diagnostic()
                    "motor1_forward":   "F",  # runMotorOutputMeasurement(1, true)
                    "motor1_backward":  "B",  # runMotorOutputMeasurement(1, false)
                    "motor2_forward":   "3",  # runMotorOutputMeasurement(2, true)
                    "motor2_backward":  "4",  # runMotorOutputMeasurement(2, false)
                    "motor1_reverse":   "R",  # runMotor1ReverseTest()
                    "dir1_low":         "L",  # DIR1 = LOW
                    "dir1_high":        "H",  # DIR1 = HIGH
                    "call_robot":       "T",  # Test standard la chemare robot
                    "start_delivery":   "T",  # Test standard la livrare
                    "request_status":   "S",  # Status (dacă va fi implementat)
                }
                
                serial_cmd = ESP32_MAP.get(msg_type)
                if serial_cmd:
                    await manager.broadcast_text(serial_cmd)
                    
                # Broadcast JSON pentru sincronizarea tabletelor (App -> App)
                save_log(data)
                await manager.broadcast_json(data)

            except json.JSONDecodeError:
                # Nu este JSON valid => Este mesaj brut de la STM32
                stm_message = raw_text.strip()
                
                # Traducem mesajul STM32 în evenimente JSON pentru Aplicație
                if stm_message.startswith("OBSTACOL"):
                    await manager.broadcast_json({"type": "robot_obstacle"})
                elif stm_message == "AM AJUNS LA DESTINATIE":
                    await manager.broadcast_json({"type": "robot_arrived_recipient", "status": "arrived"})
                elif stm_message.startswith("LIVRARE CONFIRMATA"):
                    # Extragem UID dacă e nevoie, deocamdată doar trimitem evenimentul
                    await manager.broadcast_json({"type": "rfid_verified"})
                else:
                    # Log fallback pentru mesaje STM32 necunoscute
                    print(f"Mesaj STM32 necunoscut: {stm_message}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Conexiune închisă")