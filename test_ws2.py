import asyncio
import websockets
import json

async def test_ws():
    uri = "wss://dramatic-basically-mortified.ngrok-free.dev/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Waiting for messages...")
            # We will send a message, then wait for the broadcast
            await websocket.send(json.dumps({
                "type": "test_broadcast",
                "message": "ping"
            }))
            
            response = await websocket.recv()
            print(f"Received: {response}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_ws())
