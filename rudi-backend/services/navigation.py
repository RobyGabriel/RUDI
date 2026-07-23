# ==========================================
# RUDI - Serviciu de NavigaÈ›ie (Dijkstra pe Grafuri RFID)
# ==========================================
# Bazat pe prototipul colegului, adaptat ca serviciu singleton
# pentru integrare Ã®n serverul FastAPI.
# ==========================================

import heapq
import json
import os
import threading
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Tuple, Set, FrozenSet


# ==========================================
# STRUCTURI DE DATE
# ==========================================

@dataclass
class Edge:
    """O muchie din graf = un segment fizic pe care robotul Ã®l parcurge."""
    to: str                         # ID-ul tag-ului RFID de la capÄƒtul segmentului
    action: str                     # "WALL_R" | "WALL_L" | "STRAIGHT"
    param_cm: float                 # distanÈ›a faÈ›Äƒ de perete (cm), dacÄƒ e cazul
    ticks: int                      # ticks de encoder pe segment (= costul Dijkstra)
    turn: Optional[str] = None      # "L90" | "R90" | "180" | None, executat la final

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "Edge":
        return Edge(**d)


@dataclass
class Graph:
    """Graf orientat: fiecare nod e un tag RFID, fiecare muchie e un segment de coridor."""
    edges: dict = field(default_factory=dict)   # node_id -> list[Edge]

    def add_edge(self, frm: str, edge: Edge):
        """AdaugÄƒ o muchie de la nodul 'frm' spre nodul edge.to."""
        self.edges.setdefault(frm, []).append(edge)

    def add_bidirectional_edge(self, frm: str, edge: Edge):
        """AdaugÄƒ muchia Ã®n ambele direcÈ›ii (pentru coridoare care pot fi parcurse dus-Ã®ntors)."""
        self.add_edge(frm, edge)
        # CreÄƒm muchia inversÄƒ cu turnul inversat
        reverse_turn = None
        if edge.turn == "L90":
            reverse_turn = "R90"
        elif edge.turn == "R90":
            reverse_turn = "L90"
        elif edge.turn == "180":
            reverse_turn = "180"

        reverse_action = edge.action
        if edge.action == "WALL_R":
            reverse_action = "WALL_L"
        elif edge.action == "WALL_L":
            reverse_action = "WALL_R"

        reverse_edge = Edge(
            to=frm,
            action=reverse_action,
            param_cm=edge.param_cm,
            ticks=edge.ticks,
            turn=reverse_turn,
        )
        self.add_edge(edge.to, reverse_edge)

    def neighbors(self, node: str) -> List[Edge]:
        """ReturneazÄƒ lista de muchii care pleacÄƒ din nodul dat."""
        return self.edges.get(node, [])

    def all_nodes(self) -> List[str]:
        """ReturneazÄƒ toate nodurile (tag-urile RFID) cunoscute Ã®n graf."""
        nodes = set(self.edges.keys())
        for es in self.edges.values():
            for e in es:
                nodes.add(e.to)
        return sorted(nodes)

    def to_dict(self) -> dict:
        return {n: [e.to_dict() for e in es] for n, es in self.edges.items()}

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)

    @staticmethod
    def from_dict(data: dict) -> "Graph":
        g = Graph()
        for n, es in data.items():
            g.edges[n] = [Edge.from_dict(e) for e in es]
        return g

    @staticmethod
    def from_json(s: str) -> "Graph":
        return Graph.from_dict(json.loads(s))


# ==========================================
# ALGORITMUL DIJKSTRA
# ==========================================

def dijkstra(
    graph: Graph,
    start: str,
    goal: str,
    blocked_edges: FrozenSet[Tuple[str, str]] = frozenset(),
) -> Tuple[Optional[int], Optional[List[Edge]]]:
    """
    GÄƒseÈ™te drumul cel mai scurt (Ã®n ticks de encoder) Ã®ntre douÄƒ tag-uri RFID.

    Args:
        graph: Graful de navigaÈ›ie.
        start: ID-ul tag-ului RFID de start.
        goal: ID-ul tag-ului RFID destinaÈ›ie.
        blocked_edges: Set de muchii blocate (obstacole/uÈ™i Ã®nchise).

    Returns:
        (cost_total_ticks, [Edge, ...]) sau (None, None) dacÄƒ e inaccesibil.
    """
    dist = {start: 0}
    prev = {}
    prev_edge = {}
    visited: Set[str] = set()
    pq = [(0, start)]

    while pq:
        d, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        if u == goal:
            break
        for edge in graph.neighbors(u):
            if (u, edge.to) in blocked_edges:
                continue
            nd = d + edge.ticks
            if nd < dist.get(edge.to, float("inf")):
                dist[edge.to] = nd
                prev[edge.to] = u
                prev_edge[edge.to] = edge
                heapq.heappush(pq, (nd, edge.to))

    if goal not in dist:
        return None, None

    # Reconstruim drumul de la start la goal
    path: List[Edge] = []
    node = goal
    while node != start:
        path.append(prev_edge[node])
        node = prev[node]
    path.reverse()
    return dist[goal], path


# ==========================================
# SESIUNEA DE ÃŽNVÄ‚ÈšARE (TEACH MODE)
# ==========================================

class TeachSession:
    """
    ÃŽnregistreazÄƒ o plimbare manualÄƒ Ã®ntre tag-uri RFID.

    ÃŽn producÈ›ie (pe ESP32/STM32):
      - on_tag() se apeleazÄƒ la fiecare citire RFID.
      - on_move() se apeleazÄƒ la fiecare update de encoder/giroscop.

    ÃŽn simulator (pe PC):
      - on_tag() È™i on_move() se apeleazÄƒ din API-urile REST.
    """

    def __init__(self, graph: Graph, bidirectional: bool = True):
        self.graph = graph
        self.bidirectional = bidirectional
        self.current_tag: Optional[str] = None
        self.ticks_accum: int = 0
        self.last_action: str = "STRAIGHT"
        self.last_param: float = 0.0
        self.last_turn: Optional[str] = None
        self.active: bool = False

    def start(self):
        """PorneÈ™te sesiunea de Ã®nvÄƒÈ›are."""
        self.active = True
        self.current_tag = None
        self.ticks_accum = 0
        print("[TEACH] Sesiune pornitÄƒ. AÈ™tept primul tag RFID...")

    def stop(self):
        """OpreÈ™te sesiunea de Ã®nvÄƒÈ›are."""
        self.active = False
        self.current_tag = None
        self.ticks_accum = 0
        print("[TEACH] Sesiune opritÄƒ.")

    def on_tag(self, tag_id: str) -> Optional[Edge]:
        """
        Apelat cÃ¢nd robotul trece peste un tag RFID.
        ReturneazÄƒ muchia creatÄƒ (dacÄƒ exista un tag anterior) sau None.
        """
        if not self.active:
            return None

        created_edge = None

        if self.current_tag is not None and self.current_tag != tag_id:
            edge = Edge(
                to=tag_id,
                action=self.last_action,
                param_cm=self.last_param,
                ticks=self.ticks_accum,
                turn=self.last_turn,
            )
            if self.bidirectional:
                self.graph.add_bidirectional_edge(self.current_tag, edge)
            else:
                self.graph.add_edge(self.current_tag, edge)

            created_edge = edge
            print(
                f"[TEACH] Muchie nouÄƒ: {self.current_tag} -> {tag_id} "
                f"({self.last_action}, {self.ticks_accum} ticks)"
            )

        self.current_tag = tag_id
        self.ticks_accum = 0
        self.last_turn = None
        return created_edge

    def on_move(
        self,
        ticks_delta: int,
        action: Optional[str] = None,
        param_cm: Optional[float] = None,
        turn: Optional[str] = None,
    ):
        """
        Apelat la fiecare update de encoder/giroscop.
        ticks_delta: cÃ¢È›i ticks s-au mai adÄƒugat de la ultimul apel.
        """
        if not self.active:
            return

        self.ticks_accum += ticks_delta
        if action is not None:
            self.last_action = action
        if param_cm is not None:
            self.last_param = param_cm
        if turn is not None:
            self.last_turn = turn


# ==========================================
# SERVICIUL SINGLETON DE NAVIGAÈšIE
# ==========================================

# Calea unde salvÄƒm/Ã®ncÄƒrcÄƒm harta (graf-ul) pe disc
_MAP_FILE = os.path.join(os.path.dirname(__file__), "..", "navigation_map.json")


class NavigationService:
    """
    Serviciu singleton care gestioneazÄƒ graful, sesiunile de teach È™i rutarea.
    Thread-safe prin lock intern.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._graph = Graph()
        self._teach_session = TeachSession(self._graph)
        self._blocked_edges: Set[Tuple[str, str]] = set()
        self._load_map()

    # --- PersistenÈ›Äƒ ---

    def _load_map(self):
        """ÃŽncarcÄƒ graful de pe disc (dacÄƒ existÄƒ)."""
        try:
            if os.path.exists(_MAP_FILE):
                with open(_MAP_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._graph = Graph.from_dict(data)
                self._teach_session = TeachSession(self._graph)
                print(f"[NAV] HartÄƒ Ã®ncÄƒrcatÄƒ: {len(self._graph.all_nodes())} noduri")
            else:
                print("[NAV] Nicio hartÄƒ salvatÄƒ. Se porneÈ™te cu graf gol.")
        except Exception as e:
            print(f"[NAV] Eroare la Ã®ncÄƒrcarea hÄƒrÈ›ii: {e}")

    def _save_map(self):
        """SalveazÄƒ graful pe disc."""
        try:
            with open(_MAP_FILE, "w", encoding="utf-8") as f:
                json.dump(self._graph.to_dict(), f, indent=2, ensure_ascii=False)
            print(f"[NAV] HartÄƒ salvatÄƒ: {len(self._graph.all_nodes())} noduri")
        except Exception as e:
            print(f"[NAV] Eroare la salvarea hÄƒrÈ›ii: {e}")

    # --- Acces la graf ---

    def get_graph(self) -> Graph:
        """ReturneazÄƒ graful curent (read-only)."""
        with self._lock:
            return self._graph

    def get_all_nodes(self) -> List[str]:
        """ReturneazÄƒ lista tuturor tag-urilor RFID (nodurilor) din hartÄƒ."""
        with self._lock:
            return self._graph.all_nodes()

    def get_map_data(self) -> dict:
        """ReturneazÄƒ harta completÄƒ ca dicÈ›ionar JSON-serializabil."""
        with self._lock:
            return {
                "nodes": self._graph.all_nodes(),
                "edges": self._graph.to_dict(),
                "blocked": list(self._blocked_edges),
            }

    def clear_map(self):
        """Șterge complet harta (graf-ul) și o salvează goală pe disc."""
        with self._lock:
            self._graph = Graph()
            # BUG FIX: TeachSession referenția graful vechi după clear_map.
            # Orice date scrise în continuare mergeau în graful șters, nu în cel nou.
            self._teach_session = TeachSession(self._graph)
            self._blocked_edges.clear()
            self._save_map()

    # --- Teach Mode ---

    def teach_start(self):
        """PorneÈ™te modul de Ã®nvÄƒÈ›are."""
        with self._lock:
            self._teach_session.start()

    def teach_stop(self):
        """OpreÈ™te modul de Ã®nvÄƒÈ›are È™i salveazÄƒ harta pe disc."""
        with self._lock:
            self._teach_session.stop()
            self._save_map()

    def teach_is_active(self) -> bool:
        """VerificÄƒ dacÄƒ modul de Ã®nvÄƒÈ›are e activ."""
        return self._teach_session.active

    def teach_on_tag(self, tag_id: str) -> Optional[dict]:
        """ProceseazÄƒ o citire RFID Ã®n modul teach. ReturneazÄƒ muchia creatÄƒ (sau None)."""
        with self._lock:
            edge = self._teach_session.on_tag(tag_id)
            if edge:
                self._save_map()
                return edge.to_dict()
            return None

    def teach_on_move(
        self,
        ticks_delta: int,
        action: Optional[str] = None,
        param_cm: Optional[float] = None,
        turn: Optional[str] = None,
    ):
        """ProceseazÄƒ un update de encoder/giroscop Ã®n modul teach."""
        with self._lock:
            self._teach_session.on_move(ticks_delta, action, param_cm, turn)

    # --- Rutare (Dijkstra) ---

    def find_route(
        self, start: str, goal: str
    ) -> Tuple[Optional[int], Optional[List[dict]]]:
        """
        CalculeazÄƒ ruta optimÄƒ Ã®ntre douÄƒ tag-uri RFID.
        RespectÄƒ muchiile blocate (obstacole/uÈ™i Ã®nchise).

        Returns:
            (cost_total_ticks, [dict_muchie, ...]) sau (None, None).
        """
        with self._lock:
            cost, path = dijkstra(
                self._graph,
                start,
                goal,
                blocked_edges=frozenset(self._blocked_edges),
            )
            if path is None:
                return None, None
            return cost, [e.to_dict() for e in path]

    # --- Obstacole Dinamice ---

    def block_edge(self, frm: str, to: str):
        """BlocheazÄƒ o muchie (ex: uÈ™Äƒ Ã®nchisÄƒ, obstacol permanent)."""
        with self._lock:
            self._blocked_edges.add((frm, to))
            print(f"[NAV] Muchie blocatÄƒ: {frm} -> {to}")

    def unblock_edge(self, frm: str, to: str):
        """DeblocheazÄƒ o muchie."""
        with self._lock:
            self._blocked_edges.discard((frm, to))
            print(f"[NAV] Muchie deblocatÄƒ: {frm} -> {to}")

    def get_blocked_edges(self) -> List[Tuple[str, str]]:
        """ReturneazÄƒ lista muchiilor blocate."""
        with self._lock:
            return list(self._blocked_edges)

    def clear_blocked_edges(self):
        """DeblocheazÄƒ toate muchiile."""
        with self._lock:
            self._blocked_edges.clear()
            print("[NAV] Toate muchiile deblocate.")


# ==========================================
# INSTANÈšA SINGLETON (importatÄƒ de router)
# ==========================================
nav_service = NavigationService()

