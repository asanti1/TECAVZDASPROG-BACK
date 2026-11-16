import json

from app.handler import Outcome, RouteRequestHandler
from app.pathfinding import DijkstraPathFinder
from app.planner import RoutePlanner
from tests.helpers import FixedGraph, grid_graph

ORIGIN = {"latitude": -38.7183, "longitude": -62.2663}


def request(trip_id="t1", **overrides) -> bytes:
    body = {
        "tripId": trip_id,
        "origin": ORIGIN,
        "stops": [
            {"orderId": "o1", "location": {"latitude": -38.7163, "longitude": -62.2643}},
        ],
    }
    body.update(overrides)
    return json.dumps(body).encode()


class Fixture:
    def __init__(self, graph=None):
        self.published: list[dict] = []
        self.fail_publish = False
        planner = RoutePlanner(FixedGraph(graph or grid_graph()), DijkstraPathFinder(), 30)
        self.handler = RouteRequestHandler(planner, self._publish)

    def _publish(self, body: bytes) -> None:
        if self.fail_publish:
            raise ConnectionError("rabbit caído")
        self.published.append(json.loads(body))


def test_calcula_publica_el_resultado_y_confirma():
    f = Fixture()

    assert f.handler.handle(request(), False) is Outcome.ACK

    assert f.published[0]["tripId"] == "t1"
    assert f.published[0]["legs"][0]["toOrderId"] == "o1"


def test_un_pedido_repetido_no_publica_otro_resultado():
    f = Fixture()

    f.handler.handle(request(), False)
    assert f.handler.handle(request(), True) is Outcome.ACK

    assert len(f.published) == 1


def test_descarta_pedidos_mal_formados_sin_reintentar():
    f = Fixture()

    for body in (b"basura", request(tripId=""), request(stops=[]), request(origin={})):
        assert f.handler.handle(body, False) is Outcome.REJECT
    assert f.published == []


def test_si_no_se_pudo_publicar_reintenta_una_vez_y_despues_descarta():
    f = Fixture()
    f.fail_publish = True

    assert f.handler.handle(request(), False) is Outcome.RETRY
    assert f.handler.handle(request(), True) is Outcome.REJECT


def test_un_viaje_que_fallo_puede_procesarse_cuando_el_problema_se_resuelve():
    f = Fixture()
    f.fail_publish = True
    f.handler.handle(request(), False)
    f.fail_publish = False

    assert f.handler.handle(request(), True) is Outcome.ACK
    assert len(f.published) == 1


def test_un_punto_fuera_de_la_zona_del_mapa_se_descarta_sin_reintentar():
    from app.map_store import OutOfCoverageError

    class SinCobertura:
        def graph_for(self, points):
            raise OutOfCoverageError("fuera de la zona")

    handler = RouteRequestHandler(RoutePlanner(SinCobertura(), DijkstraPathFinder(), 30), lambda body: None)

    assert handler.handle(request(), redelivered=False) == Outcome.REJECT
