import itertools
import math
import random

import pytest

from app.ordering import NearestNeighborOrderer, TwoOptOrderer, route_cost


def euclidean(points):
    return lambda a, b: math.dist(points[a], points[b])


def optimum(count, distance):
    """Fuerza bruta: la mejor de todas las permutaciones (solo viable con pocas paradas)."""
    return min(itertools.permutations(range(1, count + 1)), key=lambda p: route_cost(list(p), distance))


CASO = [(12, 13), (1, 8), (16, 15), (12, 9), (15, 11), (18, 6), (16, 4)]


def test_vecino_mas_cercano_elige_siempre_la_parada_mas_proxima():
    points = [(0, 0), (10, 0), (1, 0), (5, 0)]
    assert NearestNeighborOrderer().order(3, euclidean(points)) == [2, 3, 1]


def test_2opt_mejora_un_orden_que_el_vecino_mas_cercano_deja_largo():
    distance = euclidean(CASO)
    greedy = NearestNeighborOrderer().order(6, distance)
    improved = TwoOptOrderer().order(6, distance)

    assert route_cost(improved, distance) < route_cost(greedy, distance)


def test_2opt_llega_al_optimo_en_un_caso_con_solucion_conocida():
    distance = euclidean(CASO)
    best = optimum(6, distance)

    assert TwoOptOrderer().order(6, distance) == list(best) == [2, 4, 5, 6, 3, 1]


@pytest.mark.parametrize("seed", range(10))
def test_2opt_nunca_empeora_ni_repite_paradas(seed):
    rng = random.Random(seed)
    points = [(rng.randint(0, 20), rng.randint(0, 20)) for _ in range(8)]
    distance = euclidean(points)

    greedy = NearestNeighborOrderer().order(7, distance)
    improved = TwoOptOrderer().order(7, distance)

    assert sorted(improved) == list(range(1, 8))
    assert route_cost(improved, distance) <= route_cost(greedy, distance) + 1e-9


def test_con_una_o_ninguna_parada_no_hay_nada_que_ordenar():
    distance = euclidean([(0, 0), (1, 1)])
    assert TwoOptOrderer().order(1, distance) == [1]
    assert TwoOptOrderer().order(0, distance) == []
