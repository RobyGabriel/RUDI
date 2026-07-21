import asyncio
import websockets

ESP32_WS_URL = "ws://192.168.4.1:81"
_esp_websocket = None


async def connect_to_esp32():
    """Task de fundal: menține o conexiune permanentă la WebSocket-ul ESP32.
    Dacă ESP-ul nu e disponibil (ex: nu s-a pornit încă), reîncercăm la 3s.
    Importăm manager local pentru a evita circularitatea la startup.
    """
    global _esp_websocket
    while True:
        try:
            print(f"[ESP32 Client] Încercare de conectare la {ESP32_WS_URL}...")
            async with websockets.connect(
                ESP32_WS_URL,
                ping_interval=20,
                ping_timeout=10,
                open_timeout=5,
            ) as websocket:
                print("[ESP32 Client] ✅ Conectat la ESP32!")
                _esp_websocket = websocket

                # Import local pentru a evita circular import la pornire
                from routers.websocket import manager

                async for message in websocket:
                    text_msg = message.strip()
                    if not text_msg:
                        continue
                    print(f"[ESP32 Client] ← ESP32: {text_msg}")

                    # Traducere mesaje text ESP32 → evenimente JSON pentru aplicație
                    if text_msg.startswith("OBSTACOL"):
                        await manager.broadcast_json({
                            "type": "robot_obstacle",
                            "message": text_msg,
                        })
                    elif "AM AJUNS LA DESTINATIE" in text_msg:
                        await manager.broadcast_json({
                            "type": "robot_arrived_recipient",
                        })
                    elif "LIVRARE CONFIRMATA" in text_msg:
                        await manager.broadcast_json({
                            "type": "rfid_verified",
                            "message": text_msg,
                        })
                    elif "STOP DE URGENTA" in text_msg:
                        await manager.broadcast_json({
                            "type": "emergency_stop_ack",
                        })
                    elif "MISIUNE PORNITA" in text_msg:
                        await manager.broadcast_json({
                            "type": "mission_started",
                        })

        except (websockets.ConnectionClosed, ConnectionRefusedError, OSError) as e:
            print(f"[ESP32 Client] ⚠ Conexiune pierdută/refuzată: {e}")
        except Exception as e:
            print(f"[ESP32 Client] ✗ Eroare neașteptată: {e}")
        finally:
            _esp_websocket = None

        print("[ESP32 Client] Reîncercare în 3 secunde...")
        await asyncio.sleep(3)


async def send_to_esp32(text_command: str):
    """Trimite o comandă text la ESP32. Silențios dacă nu e conectat."""
    global _esp_websocket
    if _esp_websocket is None:
        print(f"[ESP32 Client] ✗ Nu există conexiune — comandă abandonată: {text_command!r}")
        return
    try:
        await _esp_websocket.send(text_command)
        print(f"[ESP32 Client] → ESP32: {text_command!r}")
    except Exception as e:
        print(f"[ESP32 Client] ✗ Eroare la trimitere {text_command!r}: {e}")
        _esp_websocket = None
