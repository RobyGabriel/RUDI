import asyncio
import websockets
import json

async def test_ws():
    uri = "wss://dramatic-basically-mortified.ngrok-free.dev/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending call_robot as admin...")
            await websocket.send(json.dumps({
                "type": "call_robot",
                "sender_id": "test_id",
                "sender": {"id": "test_id", "name": "TestAdmin", "email": "admin@test.com", "role": "admin", "office": "Test"},
                "user_role": "admin",
                "status": "coming_to_sender"
            }))
            
            response = await websocket.recv()
            print(f"Received: {response}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_ws())
