import asyncio
import websockets

async def test():
    async with websockets.connect("ws://localhost:8000/ws") as ws:
        await ws.send('{"target_employee": "Darius", "status": "call"}')
        response = await ws.recv()
        print("Răspuns:", response)

asyncio.run(test())