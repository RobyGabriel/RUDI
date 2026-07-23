import asyncio
import websockets
import json
import urllib.request

# Test changing the robot status to in_transit
async def test_ws():
    uri = "wss://dramatic-basically-mortified.ngrok-free.dev/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending start_delivery...")
            await websocket.send(json.dumps({
                "type": "start_delivery",
                "from": "1",
                "to": "3",
                "from_user": {"id": "1", "name": "Ionut", "email": "ionut@test.com", "role": "admin", "office": "Test"},
                "to_user": {"id": "3", "name": "Darius", "email": "darius@test.com", "role": "employee", "office": "Test2"},
                "user_role": "admin",
                "status": "in_transit"
            }))
            
            response = await websocket.recv()
            print(f"Received WS: {response}")
            
    except Exception as e:
        print(f"WS Error: {e}")

asyncio.run(test_ws())

# Fetch API status to see what is stored in DB
req = urllib.request.urlopen("https://dramatic-basically-mortified.ngrok-free.dev/robot/status")
print(f"API DB Status: {req.read().decode('utf-8')}")
