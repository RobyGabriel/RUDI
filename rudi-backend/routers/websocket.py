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


from models import CommandLog, RobotStatus
from sqlmodel import select

def process_and_save_event(data: dict):
    with Session(engine) as session:
        # Salvează istoricul
        log_entry = CommandLog(
            requested_by=data.get("sender_id") or (
                data.get("from_user", {}).get("id")
                if isinstance(data.get("from_user"), dict) else None
            ),
            target_employee=data.get("to") or data.get("target_employee"),
            status=data.get("status") or data.get("type"),
        )
        session.add(log_entry)

        # Actualizează starea curentă a robotului (Active Delivery)
        status = session.exec(select(RobotStatus)).first()
        if not status:
            status = RobotStatus()
            session.add(status)
            
        msg_type = data.get("type")
        
        if msg_type == 'call_robot':
            status.delivery_status = 'coming_to_sender'
            status.sender_id = str(data.get("sender_id", ""))
            status.sender_data = json.dumps(data.get("sender")) if data.get("sender") else None
            status.recipient_id = None
            status.recipient_data = None
            
        elif msg_type == 'robot_arrived_sender':
            status.delivery_status = 'arrived_at_sender'
            
        elif msg_type == 'start_delivery':
            status.delivery_status = 'in_transit'
            status.sender_id = str(data.get("from", ""))
            status.recipient_id = str(data.get("to", ""))
            from_user = data.get("from_user")
            to_user = data.get("to_user")
            status.sender_data = json.dumps(from_user) if isinstance(from_user, dict) else None
            status.recipient_data = json.dumps(to_user) if isinstance(to_user, dict) else None
            
            # Creare Notificare în DB pentru istoricul destinatarului (și al expeditorului)
            if isinstance(to_user, dict) and to_user.get("email"):
                from models import Notification
                new_notif = Notification(
                    recipient_email=to_user.get("email"),
                    sender_email=from_user.get("email") if isinstance(from_user, dict) else None,
                    message="Ai primit un pachet nou.",
                    status="pending"
                )
                session.add(new_notif)
            
        elif msg_type == 'robot_arrived_recipient':
            status.delivery_status = 'arrived'
            
        elif msg_type in ('delivery_confirmed', 'confirm_delivery', 'emergency_stop'):
            # Dacă era o livrare în curs, o marcăm ca finalizată în notificări
            if msg_type in ('delivery_confirmed', 'confirm_delivery') and status.recipient_data:
                try:
                    to_user = json.loads(status.recipient_data)
                    if to_user and to_user.get("email"):
                        from models import Notification
                        # Căutăm ultima notificare pending pentru acest user
                        notif = session.exec(
                            select(Notification)
                            .where(Notification.recipient_email == to_user.get("email"))
                            .where(Notification.status == "pending")
                            .order_by(Notification.id.desc())
                        ).first()
                        if notif:
                            notif.status = "delivered"
                            session.add(notif)
                except Exception as e:
                    print("Eroare la marcarea notificării ca delivered:", e)

            status.delivery_status = 'idle'
            status.sender_id = None
            status.recipient_id = None
            status.sender_data = None
            status.recipient_data = None
            
        session.commit()
        return status.delivery_status


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Citim text brut pentru a nu crăpa la mesaje de la anumite terminale
            raw_text = await websocket.receive_text()
            print(f"Mesaj WS primit: {raw_text}")
            
            # Încercăm să parsăm JSON (dacă vine de la Aplicație)
            try:
                data = json.loads(raw_text)
                
                # Este JSON valid venit de la Aplicație
                msg_type = data.get("type")
                
                # Verificăm starea curentă a livrării pentru a aplica logica de blocare
                with Session(engine) as session:
                    status_row = session.exec(select(RobotStatus)).first()
                    current_delivery_status = status_row.delivery_status if status_row else 'idle'
                    current_sender_id = status_row.sender_id if status_row else None

                user_role = data.get("user_role", "employee")
                user_id = str(data.get("from_user", {}).get("id", "")) if isinstance(data.get("from_user"), dict) else str(data.get("sender_id", ""))
                
                # Blocăm 'call_robot' și 'test_motors' dacă robotul e ocupat și userul nu e admin
                if msg_type in {'call_robot', 'test_motors'} and current_delivery_status != 'idle':
                    if user_role != 'admin':
                        print(f"WS Blocked: {msg_type} respins. Robotul este ocupat (status: {current_delivery_status}) și userul nu este admin.")
                        await websocket.send_json({"type": "error", "message": "Robotul este ocupat. Doar adminii îl pot întrerupe."})
                        continue
                        
                # Blocăm 'start_delivery' dacă robotul NU e la expeditor (sau nu e expeditorul corect)
                if msg_type == 'start_delivery' and current_delivery_status != 'idle':
                    if current_delivery_status != 'arrived_at_sender' and user_role != 'admin':
                        print(f"WS Blocked: {msg_type} respins. Robotul nu a sosit la expeditor încă.")
                        await websocket.send_json({"type": "error", "message": "Nu poți trimite comanda. Robotul este ocupat cu altă livrare."})
                        continue

                # --- INTEGRARE CU ESP32 (HTTP) ---
                if msg_type in ["call_robot", "start_delivery", "go_idle"]:
                    import urllib.request
                    import threading
                    
                    def trigger_esp():
                        try:
                            print(f"Trimit HTTP către ESP32 pentru comanda: {msg_type}")
                            urllib.request.urlopen("http://192.168.0.19/led/toggle", timeout=2)
                        except Exception as e:
                            print("Eroare comunicare cu ESP32:", e)
                    
                    threading.Thread(target=trigger_esp).start()
                # ---------------------------

                # Actualizăm starea și istoricul (dacă e eveniment de livrare)
                LOGGABLE_EVENTS = {'call_robot', 'robot_arrived_sender', 'start_delivery', 'robot_arrived_recipient', 'delivery_confirmed', 'confirm_delivery', 'emergency_stop'}
                if msg_type in LOGGABLE_EVENTS:
                    process_and_save_event(data)

                # Broadcast JSON pentru sincronizarea tabletelor (App -> App)
                await manager.broadcast_json(data)

            except json.JSONDecodeError:
                # Dacă mesajul nu e JSON, îl ignorăm
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Conexiune închisă")