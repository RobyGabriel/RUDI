import asyncio
import websockets
import json

async def run():
    async with websockets.connect("ws://localhost:8000/ws") as ws:
        await ws.send(json.dumps({
            "type": "call_robot",
            "sender_id": "1",
            "sender": {"id": "1", "name": "Ionut"},
            "status": "coming_to_sender",
            "user_role": "admin"
        }))
        await asyncio.sleep(1) # wait for process
        print("Sent!")

asyncio.run(run())
