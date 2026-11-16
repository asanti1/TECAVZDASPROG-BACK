import json
import sys
import time
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
PASSWORD = "demo1234"
YERBA = "a0000000-0000-4000-8000-000000000001"
ADDRESSES = [
    (-38.7140, -62.2650),
    (-38.7230, -62.2590),
    (-38.7090, -62.2700),
]
WAIT_SECONDS = 120


def call(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        sys.exit(f"{method} {path} -> {error.code}: {error.read().decode()}")


def login(email: str) -> str:
    return call("POST", "/auth/login", {"email": email, "password": PASSWORD})["accessToken"]


def main() -> None:
    customer = login("cliente@demo.local")
    admin = login("admin@demo.local")
    orders = [
        call("POST", "/orders", {
            "type": "CUSTOMER",
            "deliveryAddress": {"latitude": lat, "longitude": lon},
            "items": [{"productId": YERBA, "quantity": 1}],
        }, customer)
        for lat, lon in ADDRESSES
    ]
    print(f"Pedidos creados: {[o['id'][:8] for o in orders]} (salen de {orders[0]['originBranchId'][:8]})")

    trip = call("POST", "/trips", {
        "orderIds": [o["id"] for o in orders],
    }, admin)
    print(f"Viaje {trip['id'][:8]} creado en estado {trip['status']} (repartidor asignado: {trip['deliveryPersonId'][:8]}); esperando las rutas...")

    deadline = time.time() + WAIT_SECONDS
    while not trip["routesReady"]:
        if time.time() > deadline:
            sys.exit("Timeout: el servicio de rutas no devolvió el resultado. ¿Está corriendo? ¿Hay mensajes en route.requests.dead?")
        time.sleep(2)
        trip = call("GET", f"/trips/{trip['id']}", token=admin)

    for leg in trip["routes"]:
        print(f"  tramo {leg['sequenceOrder']}: {leg['distanceKm']} km, {leg['estimatedTimeMin']} min, "
              f"{len(leg['geometry'])} puntos ({leg['algorithmUsed']})")

    print("Salida:", call("POST", f"/trips/{trip['id']}/start", token=admin)["status"])
    print("Entrega:", call("POST", f"/trips/{trip['id']}/complete", token=admin)["status"])
    print("OK")


main()
