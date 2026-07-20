import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from main import app
from database import get_session
from auth import API_KEY

# Folosim o bază de date în memorie pentru teste, astfel încât
# să nu afectăm baza de date reală (rudi_database.db).
engine = create_engine(
    "sqlite://", 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)

def get_session_override():
    with Session(engine) as session:
        yield session

# Suprascriem dependența de sesiune din FastAPI pentru a o folosi pe cea de test
app.dependency_overrides[get_session] = get_session_override

client = TestClient(app)
HEADERS = {"x-api-key": API_KEY}

def setup_module(module):
    # Creăm tabelele în baza de date in-memory la începutul testelor
    SQLModel.metadata.create_all(engine)

def teardown_module(module):
    # Ștergem tot la final
    SQLModel.metadata.drop_all(engine)

# --- Teste pentru Root ---
def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "rudi backend online"}

# --- Teste pentru Autentificare și Angajați ---
def test_create_employee():
    response = client.post(
        "/employees",
        headers=HEADERS,
        json={
            "name": "Test User",
            "email": "test@example.com",
            "station_id": "ST-01",
            "password": "password123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data

def test_list_employees():
    response = client.get("/employees", headers=HEADERS)
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_login_success():
    response = client.post(
        "/employees/login",
        headers=HEADERS,
        json={
            "email": "test@example.com",
            "password": "password123"
        }
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

def test_login_failure():
    response = client.post(
        "/employees/login",
        headers=HEADERS,
        json={
            "email": "test@example.com",
            "password": "wrongpassword"
        }
    )
    assert response.status_code == 401

def test_update_employee():
    # Obținem id-ul primului angajat
    emp_id = client.get("/employees", headers=HEADERS).json()[0]["id"]
    response = client.put(
        f"/employees/{emp_id}",
        headers=HEADERS,
        json={
            "name": "Updated Test User",
            "department": "IT"
        }
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Test User"
    assert response.json()["department"] == "IT"

# --- Teste pentru Comenzi ---
def test_queue_command():
    response = client.post(
        "/robot/command",
        headers=HEADERS,
        json={
            "action": "start",
            "speed": 50
        }
    )
    assert response.status_code == 200
    assert response.json()["action"] == "start"

def test_get_next_command():
    response = client.get("/robot/command/next", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["action"] == "start"
    
    # A doua oară comanda trebuie să fi fost consumată
    response2 = client.get("/robot/command/next", headers=HEADERS)
    assert response2.status_code == 200
    assert response2.json()["action"] == "none"

# --- Teste pentru Hartă / Obstacole ---
def test_add_obstacle():
    response = client.post(
        "/map/obstacles",
        headers=HEADERS,
        json={
            "x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["x1"] == 0.0

def test_list_obstacles():
    response = client.get("/map/obstacles", headers=HEADERS)
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_get_map_snapshot():
    response = client.get("/map/full", headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "stations" in data
    assert "robot" in data
    assert "obstacles" in data

# --- Teste pentru Starea Robotului ---
def test_update_robot_status():
    response = client.post(
        "/robot/status",
        headers=HEADERS,
        json={
            "battery": 90,
            "is_moving": True,
            "current_station": "ST-01",
            "x": 5.0,
            "y": 5.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["battery"] == 90
    assert data["is_moving"] == True

def test_get_robot_status():
    response = client.get("/robot/status", headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["battery"] == 90

# --- Teste pentru Notificări ---
def test_create_notification():
    response = client.post(
        "/notifications/",
        headers=HEADERS,
        json={
            "recipient_email": "test@example.com",
            "message": "Robot a ajuns"
        }
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Robot a ajuns"

def test_get_user_notifications():
    response = client.get("/notifications/test@example.com", headers=HEADERS)
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_update_notification_status():
    notif = client.get("/notifications/test@example.com", headers=HEADERS).json()[0]
    response = client.patch(
        f"/notifications/{notif['id']}",
        headers=HEADERS,
        json={
            "status": "read"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "read"

# --- Teste pentru Logs ---
def test_list_logs():
    response = client.get("/logs", headers=HEADERS)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# --- Curățare: Ștergere Angajat ---
def test_delete_employee():
    emp_id = client.get("/employees", headers=HEADERS).json()[0]["id"]

    response = client.delete(f"/employees/{emp_id}", headers=HEADERS)
    assert response.status_code == 200

    get_response = client.get(f"/employees/{emp_id}", headers=HEADERS)
    assert get_response.status_code == 404
