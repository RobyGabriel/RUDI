import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_db_and_tables
from routers import commands, employees, websocket, logs, robot_status , map, notif


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    from esp32_client import connect_to_esp32
    esp_task = asyncio.create_task(connect_to_esp32())
    yield
    esp_task.cancel()

app = FastAPI(title="Rudi Robot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "rudi backend online"}


app.include_router(employees.router)
app.include_router(websocket.router)
app.include_router(logs.router)
app.include_router(robot_status.router)
app.include_router(map.router)
app.include_router(notif.router)
app.include_router(commands.router)