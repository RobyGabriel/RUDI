"""
Teste pytest pentru sistemul de navigație RUDI.

Acoperire:
  - Unit tests: Graph, Edge, dijkstra(), TeachSession
  - Integration tests: toate endpoint-urile /api/nav/ prin FastAPI TestClient
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from main import app
from database import get_session
from auth import API_KEY

# ============================================================
# Setup TestClient (reutilizăm aceeași convenție ca test_api.py)
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
# UNIT TESTS — Graph & Edge (fără server, fără DB)
# ============================================================

from services.navigation import Edge, Graph, dijkstra, TeachSession


class TestEdge:
    def test_to_dict_roundtrip(self):
        """Edge → dict → Edge trebuie să fie identice."""
        e = Edge(to="B", action="WALL_R", param_cm=25.0, ticks=500, turn="L90")
        restored = Edge.from_dict(e.to_dict())
        assert restored == e

    def test_to_dict_no_turn(self):
        e = Edge(to="B", action="STRAIGHT", param_cm=0.0, ticks=200)
        d = e.to_dict()
        assert d["turn"] is None
        assert d["to"] == "B"


class TestGraph:
    def _make_simple_graph(self) -> Graph:
        """Creează un graf simplu A→B→C."""
        g = Graph()
        g.add_edge("A", Edge(to="B", action="STRAIGHT", param_cm=0.0, ticks=100))
        g.add_edge("B", Edge(to="C", action="STRAIGHT", param_cm=0.0, ticks=200))
        return g

    def test_all_nodes(self):
        g = self._make_simple_graph()
        nodes = g.all_nodes()
        assert "A" in nodes
        assert "B" in nodes
        assert "C" in nodes

    def test_neighbors(self):
        g = self._make_simple_graph()
        neighbors = g.neighbors("A")
        assert len(neighbors) == 1
        assert neighbors[0].to == "B"

    def test_neighbors_unknown_node(self):
        g = self._make_simple_graph()
        assert g.neighbors("NECUNOSCUT") == []

    def test_bidirectional_edge(self):
        """add_bidirectional_edge trebuie să creeze muchia în ambele direcții."""
        g = Graph()
        g.add_bidirectional_edge("A", Edge(to="B", action="WALL_R", param_cm=25.0, ticks=100, turn="L90"))
        # A→B
        assert any(e.to == "B" for e in g.neighbors("A"))
        # B→A (invers)
        reverse_edges = g.neighbors("B")
        assert any(e.to == "A" for e in reverse_edges)

    def test_bidirectional_turn_inversion(self):
        """Turn-ul trebuie inversat corect L90↔R90."""
        g = Graph()
        g.add_bidirectional_edge("A", Edge(to="B", action="WALL_R", param_cm=25.0, ticks=100, turn="L90"))
        reverse = next(e for e in g.neighbors("B") if e.to == "A")
        assert reverse.turn == "R90"

    def test_bidirectional_action_inversion(self):
        """Acțiunea WALL_R↔WALL_L trebuie inversată."""
        g = Graph()
        g.add_bidirectional_edge("A", Edge(to="B", action="WALL_R", param_cm=25.0, ticks=100))
        reverse = next(e for e in g.neighbors("B") if e.to == "A")
        assert reverse.action == "WALL_L"

    def test_to_dict_from_dict_roundtrip(self):
        g = self._make_simple_graph()
        restored = Graph.from_dict(g.to_dict())
        assert restored.all_nodes() == g.all_nodes()

    def test_to_json_from_json_roundtrip(self):
        g = self._make_simple_graph()
        restored = Graph.from_json(g.to_json())
        assert restored.all_nodes() == g.all_nodes()


class TestDijkstra:
    def _build_graph(self) -> Graph:
        """
        Graf pentru teste:
          A --100--> B --200--> C
               \\--500----------/  (ruta directă mai scumpă)
        """
        g = Graph()
        g.add_edge("A", Edge(to="B", action="STRAIGHT", param_cm=0.0, ticks=100))
        g.add_edge("B", Edge(to="C", action="STRAIGHT", param_cm=0.0, ticks=200))
        g.add_edge("A", Edge(to="C", action="STRAIGHT", param_cm=0.0, ticks=500))
        return g

    def test_shortest_path_found(self):
        g = self._build_graph()
        cost, path = dijkstra(g, "A", "C")
        assert cost == 300          # A→B→C: 100+200
        assert len(path) == 2
        assert path[0].to == "B"
        assert path[1].to == "C"

    def test_direct_vs_indirect(self):
        """Dijkstra alege ruta cu cost 300, nu cea directă cu cost 500."""
        g = self._build_graph()
        cost, _ = dijkstra(g, "A", "C")
        assert cost < 500

    def test_same_start_and_goal(self):
        g = self._build_graph()
        cost, path = dijkstra(g, "A", "A")
        assert cost == 0
        assert path == []

    def test_no_path(self):
        """Dacă nu există drum, returnează (None, None)."""
        g = self._build_graph()
        cost, path = dijkstra(g, "C", "A")   # graful e orientat, nu există retur
        assert cost is None
        assert path is None

    def test_blocked_edge_reroute(self):
        """Blocarea muchiei A→B forțează ruta directă mai scumpă A→C."""
        g = self._build_graph()
        cost, path = dijkstra(g, "A", "C", blocked_edges=frozenset({("A", "B")}))
        assert cost == 500
        assert len(path) == 1

    def test_all_edges_blocked_no_path(self):
        """Dacă toate drumurile spre C sunt blocate, nu există rută."""
        g = self._build_graph()
        cost, path = dijkstra(
            g, "A", "C",
            blocked_edges=frozenset({("A", "B"), ("A", "C")})
        )
        assert cost is None

    def test_unknown_start(self):
        g = self._build_graph()
        cost, path = dijkstra(g, "NECUNOSCUT", "C")
        assert cost is None

    def test_unknown_goal(self):
        g = self._build_graph()
        cost, path = dijkstra(g, "A", "NECUNOSCUT")
        assert cost is None


class TestTeachSession:
    def _fresh_session(self, bidirectional=True) -> TeachSession:
        g = Graph()
        return TeachSession(g, bidirectional=bidirectional)

    def test_initial_state(self):
        ts = self._fresh_session()
        assert not ts.active
        assert ts.current_tag is None
        assert ts.ticks_accum == 0

    def test_start_stop(self):
        ts = self._fresh_session()
        ts.start()
        assert ts.active
        ts.stop()
        assert not ts.active

    def test_on_tag_no_active(self):
        """Dacă sesiunea nu e activă, on_tag returnează None și ignoră tag-ul."""
        ts = self._fresh_session()
        result = ts.on_tag("TAG_A")
        assert result is None
        assert ts.current_tag is None

    def test_first_tag_sets_start(self):
        ts = self._fresh_session()
        ts.start()
        result = ts.on_tag("TAG_A")
        assert result is None          # primul tag: nicio muchie creată
        assert ts.current_tag == "TAG_A"

    def test_second_tag_creates_edge(self):
        ts = self._fresh_session()
        ts.start()
        ts.on_tag("TAG_A")
        ts.on_move(300, action="STRAIGHT", param_cm=0.0)
        edge = ts.on_tag("TAG_B")
        assert edge is not None
        assert edge.to == "TAG_B"
        assert edge.ticks == 300

    def test_move_accumulates_ticks(self):
        ts = self._fresh_session()
        ts.start()
        ts.on_move(100)
        ts.on_move(200)
        ts.on_move(50)
        assert ts.ticks_accum == 350

    def test_ticks_reset_after_tag(self):
        ts = self._fresh_session()
        ts.start()
        ts.on_tag("TAG_A")
        ts.on_move(500)
        ts.on_tag("TAG_B")
        assert ts.ticks_accum == 0    # resetat după tag

    def test_on_move_no_active(self):
        """on_move fără sesiune activă nu face nimic."""
        ts = self._fresh_session()
        ts.on_move(999)
        assert ts.ticks_accum == 0

    def test_bidirectional_creates_two_edges(self):
        ts = self._fresh_session(bidirectional=True)
        ts.start()
        ts.on_tag("TAG_A")
        ts.on_move(100, action="WALL_R", param_cm=25.0)
        ts.on_tag("TAG_B")
        # A→B și B→A
        assert any(e.to == "TAG_B" for e in ts.graph.neighbors("TAG_A"))
        assert any(e.to == "TAG_A" for e in ts.graph.neighbors("TAG_B"))

    def test_same_tag_no_edge(self):
        """Dacă robotul citește același tag de două ori consecutiv, nu se creează muchie."""
        ts = self._fresh_session()
        ts.start()
        ts.on_tag("TAG_A")
        ts.on_move(100)
        edge = ts.on_tag("TAG_A")   # același tag
        assert edge is None


# ============================================================
# INTEGRATION TESTS — API /api/nav/ prin TestClient
# ============================================================

# Fixture care resetează nav_service înainte de fiecare test API
# pentru a evita poluarea stării între teste.
@pytest.fixture(autouse=False)
def clean_nav():
    """Resetează complet nav_service și oprește teach mode înainte de test."""
    from services.navigation import nav_service
    nav_service.clear_map()
    if nav_service.teach_is_active():
        nav_service.teach_stop()
    yield
    nav_service.clear_map()
    if nav_service.teach_is_active():
        nav_service.teach_stop()


# --- Hartă ---

def test_api_get_map_empty(clean_nav):
    r = client.get("/api/nav/map", headers=HEADERS)
    assert r.status_code == 200
    data = r.json()
    assert data["nodes"] == []
    assert data["edges"] == {}
    assert data["teach_active"] == False


def test_api_clear_map(clean_nav):
    # Mai întâi punem ceva în hartă
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "X"})
    client.post("/api/nav/teach/stop", headers=HEADERS)

    r = client.delete("/api/nav/map", headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["success"] == True

    # Harta trebuie să fie goală
    r2 = client.get("/api/nav/map", headers=HEADERS)
    assert r2.json()["nodes"] == []


# --- Teach Mode ---

def test_api_teach_status_initially_inactive(clean_nav):
    r = client.get("/api/nav/teach/status", headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["active"] == False


def test_api_teach_start_stop(clean_nav):
    r = client.post("/api/nav/teach/start", headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["active"] == True

    r2 = client.post("/api/nav/teach/stop", headers=HEADERS)
    assert r2.status_code == 200
    assert r2.json()["active"] == False


def test_api_teach_start_idempotent(clean_nav):
    """Dacă teach e deja activ, un al doilea start trebuie să returneze 200 fără eroare."""
    client.post("/api/nav/teach/start", headers=HEADERS)
    r = client.post("/api/nav/teach/start", headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["active"] == True
    client.post("/api/nav/teach/stop", headers=HEADERS)


def test_api_teach_tag_without_active_returns_400(clean_nav):
    r = client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_A"})
    assert r.status_code == 400


def test_api_teach_move_without_active_returns_400(clean_nav):
    r = client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 100})
    assert r.status_code == 400


def test_api_teach_full_flow_creates_edge(clean_nav):
    """Flux complet: start → tag → move → tag → stop → harta conține muchie."""
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_A"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 400, "action": "STRAIGHT", "param_cm": 0.0})
    r_edge = client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_B"})
    client.post("/api/nav/teach/stop", headers=HEADERS)

    # Răspunsul la al doilea tag trebuie să conțină muchia creată
    data = r_edge.json()
    assert "edge" in data
    assert data["edge"]["to"] == "TAG_B"
    assert data["edge"]["ticks"] == 400

    # Harta trebuie să aibă nodurile
    map_r = client.get("/api/nav/map", headers=HEADERS)
    assert "TAG_A" in map_r.json()["nodes"]
    assert "TAG_B" in map_r.json()["nodes"]


# --- Rutare Dijkstra ---

def _seed_simple_map():
    """Populează harta cu un traseu simplu TAG_A → TAG_B → TAG_C."""
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_A"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 100, "action": "STRAIGHT", "param_cm": 0.0})
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_B"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 200, "action": "STRAIGHT", "param_cm": 0.0})
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_C"})
    client.post("/api/nav/teach/stop", headers=HEADERS)


def test_api_route_not_found_unknown_start(clean_nav):
    _seed_simple_map()
    r = client.post("/api/nav/route", headers=HEADERS, json={"start": "NECUNOSCUT", "goal": "TAG_C"})
    assert r.status_code == 404


def test_api_route_not_found_unknown_goal(clean_nav):
    _seed_simple_map()
    r = client.post("/api/nav/route", headers=HEADERS, json={"start": "TAG_A", "goal": "NECUNOSCUT"})
    assert r.status_code == 404


def test_api_route_success(clean_nav):
    _seed_simple_map()
    r = client.post("/api/nav/route", headers=HEADERS, json={"start": "TAG_A", "goal": "TAG_C"})
    assert r.status_code == 200
    data = r.json()
    assert data["success"] == True
    assert data["cost"] == 300       # 100 + 200
    assert len(data["steps"]) == 2


def test_api_route_cost_optimal(clean_nav):
    """Dijkstra trebuie să aleagă ruta optimă, nu prima găsită."""
    # Adăugăm o rută directă mai scumpă A→C cu 999 ticks (via un al doilea teach)
    _seed_simple_map()
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_A"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 999, "action": "STRAIGHT", "param_cm": 0.0})
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_C"})
    client.post("/api/nav/teach/stop", headers=HEADERS)

    r = client.post("/api/nav/route", headers=HEADERS, json={"start": "TAG_A", "goal": "TAG_C"})
    data = r.json()
    assert data["success"] == True
    assert data["cost"] == 300   # nu 999


def test_api_route_no_path_when_all_blocked(clean_nav):
    _seed_simple_map()
    # Blocăm toate muchiile spre TAG_C
    client.post("/api/nav/block", headers=HEADERS, json={"frm": "TAG_B", "to": "TAG_C"})
    client.post("/api/nav/block", headers=HEADERS, json={"frm": "TAG_A", "to": "TAG_C"})

    r = client.post("/api/nav/route", headers=HEADERS, json={"start": "TAG_A", "goal": "TAG_C"})
    assert r.status_code == 200
    data = r.json()
    assert data["success"] == False


# --- Obstacole dinamice ---

def test_api_block_and_unblock(clean_nav):
    _seed_simple_map()

    # Blocare
    r = client.post("/api/nav/block", headers=HEADERS, json={"frm": "TAG_A", "to": "TAG_B"})
    assert r.status_code == 200

    blocked_r = client.get("/api/nav/blocked", headers=HEADERS)
    assert blocked_r.json()["count"] == 1

    # Deblocare
    r2 = client.post("/api/nav/unblock", headers=HEADERS, json={"frm": "TAG_A", "to": "TAG_B"})
    assert r2.status_code == 200

    blocked_r2 = client.get("/api/nav/blocked", headers=HEADERS)
    assert blocked_r2.json()["count"] == 0


def test_api_block_reroutes_correctly(clean_nav):
    """Blocarea rutei principale forțează ruta alternativă."""
    # Rută principală: A→B→C (cost 300)
    _seed_simple_map()

    # Rută alternativă: A→C directă (cost 700) - al doilea teach
    client.post("/api/nav/teach/start", headers=HEADERS)
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_A"})
    client.post("/api/nav/teach/move", headers=HEADERS, json={"ticks_delta": 700, "action": "STRAIGHT", "param_cm": 0.0})
    client.post("/api/nav/teach/tag", headers=HEADERS, json={"tag_id": "TAG_C"})
    client.post("/api/nav/teach/stop", headers=HEADERS)

    # Fără blocare: cost optim = 300
    r1 = client.post("/api/nav/route", headers=HEADERS, json={"start": "TAG_A", "goal": "TAG_C"})
    assert r1.json()["cost"] == 300

    # Blocăm ruta principală
    client.post("/api/nav/block", headers=HEADERS, json={"frm": "TAG_A", "to": "TAG_B"})

    # Acum trebuie să folosească ruta alternativă = 700
    r2 = client.post("/api/nav/route", headers=HEADERS, json={"start": "TAG_A", "goal": "TAG_C"})
    assert r2.json()["cost"] == 700


def test_api_clear_all_blocked(clean_nav):
    _seed_simple_map()
    client.post("/api/nav/block", headers=HEADERS, json={"frm": "TAG_A", "to": "TAG_B"})
    client.post("/api/nav/block", headers=HEADERS, json={"frm": "TAG_B", "to": "TAG_C"})

    r = client.delete("/api/nav/blocked", headers=HEADERS)
    assert r.status_code == 200

    blocked_r = client.get("/api/nav/blocked", headers=HEADERS)
    assert blocked_r.json()["count"] == 0


def test_api_requires_auth():
    """Endpoint-urile de navigație trebuie să respingă cererile fără API key.
    FastAPI poate returna 403 (Forbidden) sau 422 (Unprocessable - lipsă header),
    ambele sunt acceptabile ca semn că accesul neautorizat e blocat.
    """
    r = client.get("/api/nav/map")
    assert r.status_code in (403, 422), f"Așteptat 403 sau 422, primit {r.status_code}"
