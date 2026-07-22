# ==========================================
# RUDI - Router API de NavigaÈ›ie
# ==========================================
# Expune serviciul de navigaÈ›ie (Dijkstra + Teach Mode)
# ca API-uri REST pe care colegul le poate apela din React Native.
# ==========================================

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from auth import verify_api_key
from services.navigation import nav_service

router = APIRouter(
    prefix="/api/nav",
    tags=["navigation"],
    dependencies=[Depends(verify_api_key)],
)


# ==========================================
# SCHEME PYDANTIC (Request / Response)
# ==========================================

class RouteRequest(BaseModel):
    """Cerere de calcul al rutei optime."""
    start: str          # Tag-ul RFID de unde pleacÄƒ robotul
    goal: str           # Tag-ul RFID unde trebuie sÄƒ ajungÄƒ


class RouteStep(BaseModel):
    """Un pas din ruta calculatÄƒ."""
    to: str
    action: str
    param_cm: float
    ticks: int
    turn: Optional[str] = None


class RouteResponse(BaseModel):
    """RÄƒspunsul cu ruta calculatÄƒ."""
    success: bool
    cost: Optional[int] = None          # Cost total Ã®n ticks de encoder
    steps: List[RouteStep] = []         # Lista paÈ™ilor de executat
    message: str = ""


class TeachTagRequest(BaseModel):
    """Cerere de citire RFID Ã®n modul Teach."""
    tag_id: str


class TeachMoveRequest(BaseModel):
    """Cerere de update encoder/giroscop Ã®n modul Teach."""
    ticks_delta: int
    action: Optional[str] = None        # "WALL_R" | "WALL_L" | "STRAIGHT"
    param_cm: Optional[float] = None    # DistanÈ›a faÈ›Äƒ de perete
    turn: Optional[str] = None          # "L90" | "R90" | "180"


class BlockEdgeRequest(BaseModel):
    """Cerere de blocare/deblocare a unei muchii."""
    frm: str        # Tag-ul RFID sursÄƒ
    to: str         # Tag-ul RFID destinaÈ›ie


class MapResponse(BaseModel):
    """Harta completÄƒ a robotului."""
    nodes: List[str]
    edges: dict
    blocked: list
    teach_active: bool


# ==========================================
# ENDPOINTS: HARTÄ‚
# ==========================================

@router.get("/map", response_model=MapResponse)
def get_map():
    """
    ReturneazÄƒ harta completÄƒ: toate nodurile RFID, toate muchiile,
    È™i lista de blocaje. Util pentru ecranul de vizualizare din aplicaÈ›ie.
    """
    data = nav_service.get_map_data()
    return MapResponse(
        nodes=data["nodes"],
        edges=data["edges"],
        blocked=data["blocked"],
        teach_active=nav_service.teach_is_active(),
    )


@router.delete("/map")
def clear_map():
    """È˜terge complet harta (graf-ul). AtenÈ›ie: ireversibil!"""
    nav_service.clear_map()
    return {"message": "Harta a fost È™tearsÄƒ complet.", "success": True}


# ==========================================
# ENDPOINTS: RUTARE (DIJKSTRA)
# ==========================================

@router.post("/route", response_model=RouteResponse)
def calculate_route(req: RouteRequest):
    """
    CalculeazÄƒ ruta optimÄƒ (cel mai puÈ›in ticks de encoder) Ã®ntre
    douÄƒ tag-uri RFID. RespectÄƒ muchiile blocate.

    Exemplu:
        POST /api/nav/route
        {"start": "TAG_INTRARE", "goal": "TAG_BIROU_ANDREI"}
    """
    all_nodes = nav_service.get_all_nodes()

    if req.start not in all_nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Nodul de start '{req.start}' nu existÄƒ Ã®n hartÄƒ. "
                   f"Noduri disponibile: {all_nodes}",
        )
    if req.goal not in all_nodes:
        raise HTTPException(
            status_code=404,
            detail=f"Nodul destinaÈ›ie '{req.goal}' nu existÄƒ Ã®n hartÄƒ. "
                   f"Noduri disponibile: {all_nodes}",
        )

    cost, path = nav_service.find_route(req.start, req.goal)

    if cost is None:
        return RouteResponse(
            success=False,
            message=f"Nu existÄƒ nicio rutÄƒ accesibilÄƒ de la '{req.start}' la '{req.goal}'. "
                    f"VerificÄƒ dacÄƒ existÄƒ muchii blocate.",
        )

    steps = [RouteStep(**step) for step in path]
    via_nodes = " -> ".join([req.start] + [s.to for s in steps])

    return RouteResponse(
        success=True,
        cost=cost,
        steps=steps,
        message=f"RutÄƒ gÄƒsitÄƒ: {via_nodes} (cost: {cost} ticks)",
    )


# ==========================================
# ENDPOINTS: TEACH MODE (ÃŽNVÄ‚ÈšARE)
# ==========================================

@router.post("/teach/start")
def teach_start():
    """PorneÈ™te modul de Ã®nvÄƒÈ›are. Robotul va Ã®nregistra traseul manual."""
    if nav_service.teach_is_active():
        return {"message": "Modul Teach este deja activ.", "active": True}
    nav_service.teach_start()
    return {"message": "Modul Teach pornit. Conduce robotul manual!", "active": True}


@router.post("/teach/stop")
def teach_stop():
    """OpreÈ™te modul de Ã®nvÄƒÈ›are È™i salveazÄƒ harta pe disc."""
    nav_service.teach_stop()
    return {"message": "Modul Teach oprit. Harta a fost salvatÄƒ.", "active": False}


@router.get("/teach/status")
def teach_status():
    """VerificÄƒ dacÄƒ modul de Ã®nvÄƒÈ›are e activ."""
    return {"active": nav_service.teach_is_active()}


@router.post("/teach/tag")
def teach_tag(req: TeachTagRequest):
    """
    SimuleazÄƒ (sau primeÈ™te de la ESP32) o citire RFID.
    DacÄƒ exista un tag anterior, se creeazÄƒ automat o muchie Ã®n graf.

    Exemplu:
        POST /api/nav/teach/tag
        {"tag_id": "TAG_INTRARE"}
    """
    if not nav_service.teach_is_active():
        raise HTTPException(
            status_code=400,
            detail="Modul Teach nu este activ. ApeleazÄƒ POST /api/nav/teach/start.",
        )

    created_edge = nav_service.teach_on_tag(req.tag_id)
    if created_edge:
        return {
            "message": f"Muchie creatÄƒ spre '{req.tag_id}'",
            "edge": created_edge,
        }
    return {"message": f"Tag '{req.tag_id}' Ã®nregistrat ca punct de start."}


@router.post("/teach/move")
def teach_move(req: TeachMoveRequest):
    """
    SimuleazÄƒ (sau primeÈ™te de la ESP32) un update de encoder/giroscop.
    AcumuleazÄƒ ticks-urile pÃ¢nÄƒ la urmÄƒtorul tag RFID.

    Exemplu:
        POST /api/nav/teach/move
        {"ticks_delta": 500, "action": "WALL_R", "param_cm": 25.0}
    """
    if not nav_service.teach_is_active():
        raise HTTPException(
            status_code=400,
            detail="Modul Teach nu este activ. ApeleazÄƒ POST /api/nav/teach/start.",
        )

    nav_service.teach_on_move(
        ticks_delta=req.ticks_delta,
        action=req.action,
        param_cm=req.param_cm,
        turn=req.turn,
    )
    return {"message": f"+{req.ticks_delta} ticks Ã®nregistraÈ›i."}


# ==========================================
# ENDPOINTS: OBSTACOLE DINAMICE
# ==========================================

@router.post("/block")
def block_edge(req: BlockEdgeRequest):
    """
    BlocheazÄƒ o muchie (ex: uÈ™Äƒ Ã®nchisÄƒ, obstacol permanent).
    Rutele viitoare vor evita aceastÄƒ muchie.
    """
    nav_service.block_edge(req.frm, req.to)
    return {"message": f"Muchie blocatÄƒ: {req.frm} -> {req.to}"}


@router.post("/unblock")
def unblock_edge(req: BlockEdgeRequest):
    """DeblocheazÄƒ o muchie blocatÄƒ anterior."""
    nav_service.unblock_edge(req.frm, req.to)
    return {"message": f"Muchie deblocatÄƒ: {req.frm} -> {req.to}"}


@router.get("/blocked")
def get_blocked():
    """ReturneazÄƒ lista muchiilor blocate."""
    blocked = nav_service.get_blocked_edges()
    return {"blocked_edges": blocked, "count": len(blocked)}


@router.delete("/blocked")
def clear_blocked():
    """DeblocheazÄƒ toate muchiile."""
    nav_service.clear_blocked_edges()
    return {"message": "Toate muchiile au fost deblocate."}

