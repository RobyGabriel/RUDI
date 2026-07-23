"""
Teste pentru cazuri limită și bug-uri potențiale în RUDI backend.

Fiecare test are un comentariu care explică DE CE ar putea eșua și CE comportament
este cel corect. Testele marcate cu [BUG CONFIRMAT] reprezintă probleme găsite deja
în producție sau logic.
"""

import pytest
import json
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from main import app
from database import get_session
from auth import API_KEY
from models import RobotStatus, Employee
from security import hash_password

# ============================================================
# Setup
# ============================================================

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override
client = TestClient(app)
HEADERS = {"x-api-key": API_KEY}

def setup_module(module):
    SQLModel.metadata.create_all(engine)

def teardown_module(module):
    SQLModel.metadata.drop_all(engine)


# ============================================================
# CATEGORIA 1: Robot Status — tabla goală
# ============================================================
# BUG CONFIRMAT: Dacă tabela RobotStatus e goală (ex: după seed sau restart),
# GET /robot/status returnează 404. Aplicația de mobil sondează la fiecare 5s
# și dacă primește 404, crăpă silențios și nu mai știe starea robotului.
# Comportament corect: GET să returneze o stare default 'idle', nu 404.

class TestRobotStatusEmptyTable:

    def test_get_status_on_empty_db_returns_idle(self):
        """
        [BUG REPARAT] GET /robot/status pe tabelă goală returna 404.
        Acum creează automat un rând default 'idle' în loc să returneze 404.
        """
        r = client.get("/robot/status", headers=HEADERS)
        assert r.status_code == 200
        assert r.json()["delivery_status"] == "idle"

    def test_post_status_on_empty_db_creates_row(self):
        """
        POST /robot/status pe tabelă goală trebuie să creeze automat rândul
        (logica de 'upsert' există în cod — verificăm că funcționează).
        """
        r = client.post("/robot/status", headers=HEADERS, json={
            "battery": 75,
            "is_moving": False,
            "delivery_status": "idle"
        })
        assert r.status_code == 200
        assert r.json()["battery"] == 75
        assert r.json()["delivery_status"] == "idle"

    def test_get_status_after_post_works(self):
        """După ce POST a creat rândul, GET trebuie să funcționeze."""
        r = client.get("/robot/status", headers=HEADERS)
        assert r.status_code == 200
        assert "delivery_status" in r.json()


# ============================================================
# CATEGORIA 2: delivery_status reset la 'idle'
# ============================================================
# Dacă trimiți delivery_status='idle', sender/recipient trebuie resetați la None.
# Dacă nu se resetează, aplicația va continua să afișeze o livrare veche.

class TestDeliveryStatusReset:

    def setup_method(self):
        """Setăm o livrare activă înainte de fiecare test."""
        client.post("/robot/status", headers=HEADERS, json={
            "delivery_status": "in_transit",
            "sender_id": "42",
            "recipient_id": "99",
            "sender_data": '{"name":"Ion"}',
            "recipient_data": '{"name":"Ana"}',
        })

    def test_set_idle_clears_sender(self):
        """Trecerea la 'idle' trebuie să șteargă sender_id."""
        r = client.post("/robot/status", headers=HEADERS, json={"delivery_status": "idle"})
        assert r.status_code == 200
        assert r.json()["sender_id"] is None

    def test_set_idle_clears_recipient(self):
        """Trecerea la 'idle' trebuie să șteargă recipient_id."""
        r = client.post("/robot/status", headers=HEADERS, json={"delivery_status": "idle"})
        assert r.json()["recipient_id"] is None

    def test_set_idle_clears_sender_data(self):
        """Trecerea la 'idle' trebuie să șteargă sender_data (JSON)."""
        r = client.post("/robot/status", headers=HEADERS, json={"delivery_status": "idle"})
        assert r.json()["sender_data"] is None

    def test_non_idle_status_preserves_sender(self):
        """
        Dacă schimbăm starea la 'arrived' (nu idle), sender_id trebuie PĂSTRAT.
        Altfel aplicația pierde cine a trimis pachetul când robotul ajunge.
        """
        client.post("/robot/status", headers=HEADERS, json={
            "delivery_status": "in_transit",
            "sender_id": "42",
        })
        r = client.post("/robot/status", headers=HEADERS, json={"delivery_status": "arrived"})
        assert r.json()["sender_id"] == "42"


# ============================================================
# CATEGORIA 3: Email duplicat la angajați
# ============================================================
# create_employee nu verifică duplicatele explicit — SQLite aruncă IntegrityError.
# FastAPI poate să nu returneze 422 clar, ci să crăpe cu 500.

class TestEmployeeDuplicateEmail:

    def test_duplicate_email_rejected(self):
        """
        [BUG CONFIRMAT → REPARAT] Crearea a doi angajați cu același email returna
        HTTP 500 (IntegrityError SQLite netratat). Am reparat employees.py să
        returneze 409 Conflict. Testul verifică că fix-ul funcționează.
        """
        r1 = client.post("/employees", headers=HEADERS, json={
            "name": "Prim User",
            "email": "duplicat2@test.com",
            "station_id": "A1",
            "password": "Test123!"
        })
        assert r1.status_code == 200

        r2 = client.post("/employees", headers=HEADERS, json={
            "name": "Alt User",
            "email": "duplicat2@test.com",  # același email
            "station_id": "A1",
            "password": "Test123!"
        })
        # După fix: 409. Dacă e 500, bug-ul ncă există.
        assert r2.status_code == 409, \
            f"Email duplicat trebuia să returneze 409, dar a returnat {r2.status_code}"

    def test_login_case_sensitive_email(self):
        """
        [BUG REPARAT] Login-ul cu email uppercase funcționează acum.
        'Ion@Thecon.ro' și 'ion@thecon.ro' sunt același cont.
        """
        client.post("/employees", headers=HEADERS, json={
            "name": "Case Test",
            "email": "case@test.com",
            "station_id": "B1",
            "password": "Pass123!"
        })
        r = client.post("/employees/login", headers=HEADERS, json={
            "email": "CASE@TEST.COM",
            "password": "Pass123!"
        })
        assert r.status_code == 200
        assert r.json()["email"] == "case@test.com"


# ============================================================
# CATEGORIA 4: Angajat inexistent
# ============================================================

class TestEmployeeNotFound:

    def test_get_nonexistent_employee(self):
        """GET pe ID care nu există trebuie să returneze 404."""
        r = client.get("/employees/999999", headers=HEADERS)
        assert r.status_code == 404

    def test_delete_nonexistent_employee(self):
        """DELETE pe ID care nu există trebuie să returneze 404, nu 500."""
        r = client.delete("/employees/999999", headers=HEADERS)
        assert r.status_code == 404

    def test_update_nonexistent_employee(self):
        """PUT pe ID care nu există trebuie să returneze 404."""
        r = client.put("/employees/999999", headers=HEADERS, json={"name": "Ghost"})
        assert r.status_code == 404

    def test_change_password_nonexistent(self):
        """POST change-password pe ID inexistent trebuie să returneze 404."""
        r = client.post("/employees/999999/change-password", headers=HEADERS,
                        json={"new_password": "NewPass123!"})
        assert r.status_code == 404


# ============================================================
# CATEGORIA 5: Navigație — cazuri limită Dijkstra
# ============================================================

from services.navigation import Edge, Graph, dijkstra, TeachSession, NavigationService

class TestDijkstraEdgeCases:

    def test_graph_with_cycle(self):
        """
        [POTENȚIAL BUG] Grafurile cu cicluri pot cauza infinite loop în implementări naive.
        Dijkstra cu visited set trebuie să termine.
        """
        g = Graph()
        # Ciclu: A→B→C→A
        g.add_edge("A", Edge(to="B", action="STRAIGHT", param_cm=0, ticks=100))
        g.add_edge("B", Edge(to="C", action="STRAIGHT", param_cm=0, ticks=100))
        g.add_edge("C", Edge(to="A", action="STRAIGHT", param_cm=0, ticks=100))
        # Trebuie să termine fără infinite loop
        cost, path = dijkstra(g, "A", "C")
        assert cost == 200
        assert path is not None

    def test_graph_with_negative_ticks(self):
        """
        [POTENȚIAL BUG] Dijkstra standard nu funcționează corect cu ticks negative.
        Un teach cu ticks_delta=0 sau negativ creează muchii cu cost 0/-1
        care pot face Dijkstra să returneze rezultate greșite.
        """
        g = Graph()
        g.add_edge("A", Edge(to="B", action="STRAIGHT", param_cm=0, ticks=0))   # cost 0
        g.add_edge("B", Edge(to="C", action="STRAIGHT", param_cm=0, ticks=100))
        g.add_edge("A", Edge(to="C", action="STRAIGHT", param_cm=0, ticks=50))  # directă mai ieftină

        cost, path = dijkstra(g, "A", "C")
        # Cu ticks=0 pe A→B, costul A→B→C = 100, dar A→C direct = 50
        # Dijkstra trebuie să aleagă 50
        assert cost == 50

    def test_disconnected_graph_no_route(self):
        """
        Graf cu două componente izolate — trebuie să returneze (None, None).
        Exemplu real: adminul a antrenat Etaj1 și Etaj2 separat fără coridor între ele.
        """
        g = Graph()
        g.add_edge("A", Edge(to="B", action="STRAIGHT", param_cm=0, ticks=100))
        g.add_edge("C", Edge(to="D", action="STRAIGHT", param_cm=0, ticks=100))
        # A→D nu există
        cost, path = dijkstra(g, "A", "D")
        assert cost is None
        assert path is None

    def test_large_graph_performance(self):
        """
        [POTENȚIAL BUG] Dijkstra trebuie să fie suficient de rapid pe grafuri mari.
        O clădire cu 50 de puncte RFID și 200 de coridoare nu trebuie să blocheze serverul.
        """
        import time
        g = Graph()
        # Creăm un lanț lung: TAG_0 → TAG_1 → ... → TAG_49
        for i in range(49):
            g.add_bidirectional_edge(
                f"TAG_{i}",
                Edge(to=f"TAG_{i+1}", action="STRAIGHT", param_cm=0, ticks=100)
            )

        start = time.time()
        cost, path = dijkstra(g, "TAG_0", "TAG_49")
        elapsed = time.time() - start

        assert cost == 4900
        assert elapsed < 0.1, f"Dijkstra a durat {elapsed:.3f}s pe 50 noduri — prea lent!"

    def test_block_nonexistent_edge_and_route_still_works(self):
        """
        [POTENȚIAL BUG] Blocarea unei muchii care nu există în graf
        nu trebuie să afecteze alte rute valide.
        """
        g = Graph()
        g.add_edge("A", Edge(to="B", action="STRAIGHT", param_cm=0, ticks=100))
        # Blocăm o muchie inexistentă
        cost, path = dijkstra(g, "A", "B", blocked_edges=frozenset({("X", "Y")}))
        assert cost == 100


# ============================================================
# CATEGORIA 6: Teach Mode — stări invalide
# ============================================================

class TestTeachEdgeCases:

    def _fresh_service(self) -> NavigationService:
        """Creăm un serviciu izolat fără fișier pe disc."""
        import unittest.mock as mock
        svc = NavigationService.__new__(NavigationService)
        svc._lock = __import__('threading').Lock()
        svc._graph = Graph()
        svc._teach_session = TeachSession(svc._graph)
        svc._blocked_edges = set()
        return svc

    def test_teach_tag_with_empty_string(self):
        """
        [POTENȚIAL BUG] Tag ID gol ('') trebuie tratat.
        Un tag RFID vid ar putea fi creat dacă ESP32-ul trimite un mesaj corupt.
        """
        ts = TeachSession(Graph())
        ts.start()
        result = ts.on_tag("")  # tag gol
        # Primul tag → nicio muchie, dar se setează ca current_tag = ""
        assert result is None
        assert ts.current_tag == ""

    def test_teach_zero_ticks_creates_edge_with_zero_cost(self):
        """
        [POTENȚIAL BUG] Dacă adminul apasă TAG fără să miște robotul (0 ticks),
        se creează o muchie cu cost 0. Dijkstra va prefera mereu aceste muchii,
        ceea ce poate genera rute absurde.
        """
        g = Graph()
        ts = TeachSession(g)
        ts.start()
        ts.on_tag("A")
        # Nu apelăm on_move — ticks_accum = 0
        edge = ts.on_tag("B")
        assert edge is not None
        assert edge.ticks == 0  # Documentăm că se poate întâmpla

    def test_teach_negative_ticks_accumulate(self):
        """
        [POTENȚIAL BUG] on_move cu ticks_delta negativ decrementează acumulatorul.
        Un encoder care merge înapoi poate genera ticks negative, deci cost negativ.
        """
        ts = TeachSession(Graph())
        ts.start()
        ts.on_tag("A")
        ts.on_move(500)
        ts.on_move(-200)  # merge înapoi
        edge = ts.on_tag("B")
        # Documentăm comportamentul: ticks = 300 (net)
        assert edge.ticks == 300

    def test_teach_cycle_a_b_a_creates_two_edges(self):
        """
        Teach-ul unui ciclu A→B→A trebuie să creeze 2 muchii distincte
        (sau 4 dacă e bidirecțional). Verificăm că nu confundă nodurile.
        """
        g = Graph()
        ts = TeachSession(g, bidirectional=False)
        ts.start()
        ts.on_tag("A")
        ts.on_move(100)
        ts.on_tag("B")
        ts.on_move(100)
        ts.on_tag("A")  # înapoi la A
        ts.stop()

        # A→B și B→A (unidirecțional, deci exact 2 muchii)
        assert any(e.to == "B" for e in g.neighbors("A"))
        assert any(e.to == "A" for e in g.neighbors("B"))


# ============================================================
# CATEGORIA 7: API Navigație — cazuri limită
# ============================================================

@pytest.fixture(autouse=False)
def clean_nav():
    from services.navigation import nav_service
    nav_service.clear_map()
    if nav_service.teach_is_active():
        nav_service.teach_stop()
    yield
    nav_service.clear_map()
    if nav_service.teach_is_active():
        nav_service.teach_stop()


def test_api_route_start_equals_goal(clean_nav):
    """
    [POTENȚIAL BUG] Ruta de la un nod la el însuși.
    Dijkstra returnează cost=0 și path=[]. Dar API-ul returnează 404
    dacă nodul nu există sau success=True cu 0 pași dacă există.
    Verificăm că nu crăpă.
    """
    # Seed rapid: un singur nod
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_SOLO"})
    client.post("/api/nav/teach/stop", headers=HEADERS)

    r = client.post("/api/nav/route", headers=HEADERS,
                    json={"start": "TAG_SOLO", "goal": "TAG_SOLO"})
    # Nod izolat — nu are vecini, dar există. Dijkstra: cost=0, path=[]
    # API-ul trebuie să returneze success sau 404 consistent, nu 500
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        assert r.json()["cost"] == 0
        assert r.json()["steps"] == []


def test_api_route_on_empty_map(clean_nav):
    """
    [POTENȚIAL BUG] Cerere de rută pe hartă complet goală.
    Trebuie să returneze 404 (nod inexistent), nu 500.
    """
    r = client.post("/api/nav/route", headers=HEADERS,
                    json={"start": "NICAIERI", "goal": "NICI_ACOLO"})
    assert r.status_code == 404


def test_api_teach_map_has_teach_active_flag(clean_nav):
    """
    GET /api/nav/map trebuie să reflecte corect teach_active=True când e activ.
    Aplicația mobilă depinde de acest flag pentru a afișa starea corectă adminului.
    """
    client.post("/api/nav/teach/start", headers=HEADERS)
    r = client.get("/api/nav/map", headers=HEADERS)
    assert r.json()["teach_active"] == True

    client.post("/api/nav/teach/stop", headers=HEADERS)
    r2 = client.get("/api/nav/map", headers=HEADERS)
    assert r2.json()["teach_active"] == False


def test_api_block_same_edge_twice(clean_nav):
    """
    [POTENȚIAL BUG] Blocarea aceleiași muchii de două ori nu trebuie să dubleze
    intrarea în lista de blocaje (set vs list internă).
    """
    # Populăm harta
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "A"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 100})
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "B"})
    client.post("/api/nav/teach/stop", headers=HEADERS)

    client.post("/api/nav/block", headers=HEADERS, json={"frm": "A", "to": "B"})
    client.post("/api/nav/block", headers=HEADERS, json={"frm": "A", "to": "B"})  # a doua oară

    r = client.get("/api/nav/blocked", headers=HEADERS)
    # Count trebuie să fie 1, nu 2 (set elimină duplicatele)
    assert r.json()["count"] == 1


def test_api_clear_map_while_teach_active(clean_nav):
    """
    [BUG REPARAT] Ștergerea hărții în timp ce Teach Mode e activ.
    Teach session referenția graful vechi — după clear_map, datele noi
    mergeau în graful șters. Acum clear_map resetează și teach session.
    """
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "INAINTE"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 100})

    # Ștergem harta în timp ce teach e activ
    client.delete("/api/nav/map", headers=HEADERS)

    # Pornim o sesiune nouă și predăm un traseu DUPA→FINAL
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "DUPA"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 100})
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "FINAL"})
    client.post("/api/nav/teach/stop", headers=HEADERS)

    r = client.get("/api/nav/map", headers=HEADERS)
    nodes = r.json()["nodes"]
    # INAINTE trebuie să NU fie în hartă (a fost șters prin clear)
    assert "INAINTE" not in nodes, f"'INAINTE' nu trebuia să existe după clear_map, dar e în: {nodes}"
    # DUPA și FINAL trebuie să fie în harta nouă
    assert "DUPA" in nodes, f"Nodul 'DUPA' lipsea din hartă după clear+teach. Noduri găsite: {nodes}"
    assert "FINAL" in nodes


# ============================================================
# CATEGORIA 8: process_and_save_event — date malformate
# ============================================================
# Funcția din websocket.py face data.get("from_user", {}).get("id")
# Dacă "from_user" e un string (nu dict), crăpă cu AttributeError.

class TestProcessAndSaveEventRobustness:

    def test_process_event_call_robot_no_sender(self):
        """
        [POTENȚIAL BUG] process_and_save_event cu 'call_robot' fără câmpul 'sender'.
        sender_data trebuie să fie None, nu să crăpe.
        """
        from routers.websocket import process_and_save_event
        # Nu trebuie să arunce excepție
        try:
            result = process_and_save_event({
                "type": "call_robot",
                "sender_id": "5",
                # "sender" lipsește complet
            })
            assert result == "coming_to_sender"
        except Exception as e:
            pytest.fail(f"process_and_save_event a crăpat cu sender lipsă: {e}")

    def test_process_event_from_user_is_string_not_dict(self):
        """
        [BUG REPARAT] from_user ca string (nu dict) nu mai cauzează crash.
        Acum sender_data devine None în loc să arunce AttributeError.
        """
        from routers.websocket import process_and_save_event
        result = process_and_save_event({
            "type": "start_delivery",
            "from": "5",
            "to": "8",
            "from_user": "Ion",  # STRING, nu dict — situație reală de la client malformat
            "to_user": "Ana",
        })
        # Dacă ajunge aici, codul e robust
        assert result == "in_transit"

    def test_process_event_unknown_type_is_ignored(self):
        """
        Tipuri de mesaje necunoscute (ex: 'ping', 'heartbeat') nu trebuie
        să modifice delivery_status. Robotul rămâne în starea curentă.
        """
        from routers.websocket import process_and_save_event
        # Mai întâi setăm o stare known
        process_and_save_event({"type": "call_robot", "sender_id": "1"})
        # Trimitem un tip necunoscut
        result = process_and_save_event({"type": "ping_heartbeat_unknown"})
        # Starea trebuie să rămână 'coming_to_sender' — nu se schimbă
        assert result == "coming_to_sender"


# ============================================================
# CATEGORIA 9: Notificări — utilizatori inexistenți
# ============================================================

class TestNotificationsEdgeCases:

    def test_get_notifications_nonexistent_user_returns_empty(self):
        """
        GET notificări pentru un email care nu există trebuie să returneze
        o listă goală [], nu 404 sau 500.
        """
        r = client.get("/notifications/nobody@nowhere.com", headers=HEADERS)
        assert r.status_code == 200
        assert r.json() == []

    def test_create_notification_no_message(self):
        """Notificarea fără câmpul 'message' trebuie să fie acceptată (message e optional)."""
        r = client.post("/notifications/", headers=HEADERS, json={
            "recipient_email": "test@edge.com"
            # message lipsește
        })
        assert r.status_code == 200

    def test_update_notification_invalid_id(self):
        """PATCH pe un ID de notificare inexistent trebuie să returneze 404, nu 500."""
        r = client.patch("/notifications/999999", headers=HEADERS, json={"status": "read"})
        assert r.status_code == 404


# ============================================================
# CATEGORIA 10: Autentificare robustă
# ============================================================

class TestAuthEdgeCases:

    def test_login_empty_password(self):
        """Login cu parolă goală trebuie să returneze 401, nu 500."""
        client.post("/employees", headers=HEADERS, json={
            "name": "Auth Test",
            "email": "authtest@edge.com",
            "station_id": "X1",
            "password": "Real123!"
        })
        r = client.post("/employees/login", headers=HEADERS, json={
            "email": "authtest@edge.com",
            "password": ""
        })
        assert r.status_code == 401

    def test_login_sql_injection_attempt(self):
        """
        [SECURITATE] Tentativă de SQL injection în câmpul email.
        SQLModel/SQLAlchemy folosesc prepared statements, deci nu trebuie să fie
        vulnerabil, dar verificăm explicit că returnează 401, nu date.
        """
        r = client.post("/employees/login", headers=HEADERS, json={
            "email": "' OR '1'='1",
            "password": "anything"
        })
        assert r.status_code == 401

    def test_all_endpoints_reject_wrong_api_key(self):
        """Toate endpoint-urile principale trebuie să respingă un API key greșit.
        Serverul returnează 401 Unauthorized (nu 403) pentru key greșit — ambele sunt corecte.
        """
        wrong_headers = {"x-api-key": "cheia-gresita-total"}
        endpoints = [
            ("GET", "/employees"),
            ("GET", "/robot/status"),
            ("GET", "/logs"),
        ]
        for method, path in endpoints:
            r = client.request(method, path, headers=wrong_headers)
            assert r.status_code in (401, 403), \
                f"{method} {path} trebuia să returneze 401/403 cu API key greșit, primit {r.status_code}"

    def test_missing_api_key_returns_error(self):
        """Cerere fără API key deloc trebuie respinsă."""
        r = client.get("/employees")
        assert r.status_code in (403, 422)
