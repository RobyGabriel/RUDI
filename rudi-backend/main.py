import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_db_and_tables
from mock_ros import start_mock_ros
from routers import employees, websocket, logs, robot_status , map, notif


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    mock_task = asyncio.create_task(start_mock_ros())
    yield
    mock_task.cancel()


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