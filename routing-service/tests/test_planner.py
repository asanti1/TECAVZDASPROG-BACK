from math import ceil

import pytest

from app.geo import haversine_m
from app.pathfinding import DijkstraPathFinder
from app.planner import RoutePlanner, Stop, UnreachableStopError
from tests.helpers import FixedGraph, grid_graph

ORIGIN = (-38.7183, -62.2663)


def planner(graph=None, speed=30.0):
    return RoutePlanner(FixedGraph(graph or grid_graph()), DijkstraPathFinder(), speed)


def at(row, col):
    return (ORIGIN[0] + row * 0.001, ORIGIN[1] + col * 0.001)


def test_visita_primero_la_parada_mas_cercana_y_numera_los_tramos():
    far = Stop("lejos", at(3, 3))
    near = Stop("cerca", at(0, 1))

    plan = planner().plan("t1", ORIGIN, [far, near])

    assert plan["tripId"] == "t1"
    assert [leg["toOrderId"] for leg in plan["legs"]] == ["cerca", "lejos"]
    assert [leg["sequenceOrder"] for leg in plan["legs"]] == [1, 2]
    assert all(leg["algorithmUsed"] == "dijkstra" for leg in plan["legs"])


def test_cada_tramo_empieza_donde_termino_el_anterior():
    plan = planner().plan("t1", ORIGIN, [Stop("a", at(0, 2)), Stop("b", at(2, 2))])
    first, second = plan["legs"]

    assert first["geometry"][0] == {"latitude": ORIGIN[0], "longitude": ORIGIN[1]}
    assert first["geometry"][-1] == second["geometry"][0]
    assert second["geometry"][-1] == {"latitude": at(2, 2)[0], "longitude": at(2, 2)[1]}


def test_distancia_y_tiempo_salen_del_camino_y_la_velocidad():
    plan = planner(speed=30).plan("t1", ORIGIN, [Stop("a", at(0, 3))])
    leg = plan["legs"][0]

    assert leg["distanceKm"] == pytest.approx(haversine_m(ORIGIN, at(0, 3)) / 1000, abs=0.001)
    assert leg["estimatedTimeMin"] == ceil(leg["distanceKm"] * 2)
    assert isinstance(leg["estimatedTimeMin"], int)


def test_una_parada_en_el_mismo_nodo_igual_tiene_geometria_valida():
    plan = planner().plan("t1", ORIGIN, [Stop("a", ORIGIN)])

    assert len(plan["legs"][0]["geometry"]) >= 2
    assert plan["legs"][0]["distanceKm"] == 0


def test_falla_si_una_parada_no_tiene_camino():
    graph = grid_graph(2)
    graph.add_node(99, (ORIGIN[0] + 0.5, ORIGIN[1]))

    with pytest.raises(UnreachableStopError):
        planner(graph).plan("t1", ORIGIN, [Stop("isla", (ORIGIN[0] + 0.5, ORIGIN[1]))])


def test_el_orden_de_visita_lo_decide_el_ordenador_inyectado():
    class AlReves:
        def order(self, stop_count, distance):
            return list(range(stop_count, 0, -1))

    p = RoutePlanner(FixedGraph(grid_graph()), DijkstraPathFinder(), 30, orderer=AlReves())
    plan = p.plan("t1", ORIGIN, [Stop("a", at(0, 1)), Stop("b", at(0, 2)), Stop("c", at(0, 3))])

    assert [leg["toOrderId"] for leg in plan["legs"]] == ["c", "b", "a"]
