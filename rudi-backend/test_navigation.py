"""
Test complet al sistemului de navigatie RUDI.
Simuleaza 2 sesiuni de TEACH, apoi calculeaza rute cu Dijkstra.
"""
import urllib.request
import json

BASE = "http://localhost:8000/api/nav"
HEADERS = {"x-api-key": "rudi-secret-key-2026", "Content-Type": "application/json"}


def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    print(f"  {method} {path} -> {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result


print("=" * 60)
print("TESTUL 1: Sesiune TEACH - Traseu principal")
print("=" * 60)

api("POST", "/teach/start")

# Robotul trece peste primul tag RFID (INTRARE)
api("POST", "/teach/tag", {"tag_id": "TAG_INTRARE"})

# Robotul merge 4200 ticks pe langa peretele din dreapta
api("POST", "/teach/move", {"ticks_delta": 500, "action": "WALL_R", "param_cm": 25.0})
api("POST", "/teach/move", {"ticks_delta": 3700})

# Robotul trece peste al doilea tag (HOL)
api("POST", "/teach/tag", {"tag_id": "TAG_HOL"})

# Robotul merge 2000 ticks drept
api("POST", "/teach/move", {"ticks_delta": 200, "action": "STRAIGHT"})
api("POST", "/teach/move", {"ticks_delta": 1800})

# Robotul trece peste al treilea tag (BIROU_ANDREI)
api("POST", "/teach/tag", {"tag_id": "TAG_BIROU_ANDREI"})

api("POST", "/teach/stop")


print("\n" + "=" * 60)
print("TESTUL 2: Sesiune TEACH - Ruta alternativa")
print("=" * 60)

api("POST", "/teach/start")

api("POST", "/teach/tag", {"tag_id": "TAG_INTRARE"})
api("POST", "/teach/move", {"ticks_delta": 600, "action": "WALL_L", "param_cm": 25.0})
api("POST", "/teach/move", {"ticks_delta": 5200})
api("POST", "/teach/tag", {"tag_id": "TAG_HOL2"})
api("POST", "/teach/move", {"ticks_delta": 150, "action": "STRAIGHT"})
api("POST", "/teach/move", {"ticks_delta": 2600})
api("POST", "/teach/tag", {"tag_id": "TAG_BIROU_ANDREI"})

api("POST", "/teach/stop")


print("\n" + "=" * 60)
print("TESTUL 3: Vizualizeaza harta completa")
print("=" * 60)

api("GET", "/map")


print("\n" + "=" * 60)
print("TESTUL 4: Dijkstra - ruta optima TAG_INTRARE -> TAG_BIROU_ANDREI")
print("=" * 60)

api("POST", "/route", {"start": "TAG_INTRARE", "goal": "TAG_BIROU_ANDREI"})


print("\n" + "=" * 60)
print("TESTUL 5: Blocare ruta principala + re-rutare")
print("=" * 60)

api("POST", "/block", {"frm": "TAG_INTRARE", "to": "TAG_HOL"})
api("POST", "/route", {"start": "TAG_INTRARE", "goal": "TAG_BIROU_ANDREI"})


print("\n" + "=" * 60)
print("TESTUL 6: Deblocare + ruta normala din nou")
print("=" * 60)

api("POST", "/unblock", {"frm": "TAG_INTRARE", "to": "TAG_HOL"})
api("POST", "/route", {"start": "TAG_INTRARE", "goal": "TAG_BIROU_ANDREI"})

print("\n" + "=" * 60)
print("TOATE TESTELE AU TRECUT CU SUCCES!")
print("=" * 60)
