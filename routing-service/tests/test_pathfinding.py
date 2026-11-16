import pytest

from app.graph import RoadGraph
from app.pathfinding import AStarPathFinder, DijkstraPathFinder
from tests.helpers import grid_graph

FINDERS = [DijkstraPathFinder(), AStarPathFinder()]


def diamond() -> RoadGraph:
    graph = RoadGraph()
    for node, point in enumerate([(0.0, 0.0), (0.0, 0.0001), (0.0001, 0.0), (0.0001, 0.0001)]):
        graph.add_node(node, point)
    graph.add_edge(0, 1, 10)
    graph.add_edge(1, 3, 10)
    graph.add_edge(0, 2, 3)
    graph.add_edge(2, 3, 4)
    graph.add_edge(0, 3, 50)
    return graph


@pytest.mark.parametrize("finder", FINDERS, ids=lambda f: f.name)
def test_elige_el_camino_mas_corto_y_no_el_de_menos_tramos(finder):
    path = finder.find(diamond(), 0, 3)

    assert path.nodes == (0, 2, 3)
    assert path.distance_m == 7


@pytest.mark.parametrize("finder", FINDERS, ids=lambda f: f.name)
def test_respeta_el_sentido_de_las_calles(finder):
    graph = diamond()  # no hay aristas de vuelta

    assert finder.find(graph, 3, 0) is None


@pytest.mark.parametrize("finder", FINDERS, ids=lambda f: f.name)
def test_origen_igual_a_destino(finder):
    path = finder.find(diamond(), 2, 2)

    assert path.nodes == (2,)
    assert path.distance_m == 0


def test_a_star_encuentra_la_misma_distancia_que_dijkstra():
    graph = grid_graph(5)
    dijkstra, a_star = DijkstraPathFinder(), AStarPathFinder()

    for source, target in [(0, 24), (4, 20), (7, 17), (12, 3)]:
        assert a_star.find(graph, source, target).distance_m == pytest.approx(
            dijkstra.find(graph, source, target).distance_m
        )
