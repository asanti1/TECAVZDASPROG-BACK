import heapq
from dataclasses import dataclass
from typing import Callable, Protocol

from app.geo import haversine_m
from app.graph import RoadGraph


@dataclass(frozen=True)
class Path:
    nodes: tuple[int, ...]
    distance_m: float


class PathFinder(Protocol):
    """Estrategia de camino mínimo: el planificador no sabe cuál algoritmo usa."""

    name: str

    def find(self, graph: RoadGraph, source: int, target: int) -> Path | None:
        """Devuelve None si el destino no se puede alcanzar."""
        ...


def _search(
    graph: RoadGraph,
    source: int,
    target: int,
    heuristic: Callable[[int], float],
) -> Path | None:
    best: dict[int, float] = {source: 0.0}
    came_from: dict[int, int] = {}
    queue: list[tuple[float, int]] = [(heuristic(source), source)]
    settled: set[int] = set()

    while queue:
        _, node = heapq.heappop(queue)
        if node in settled:
            continue
        if node == target:
            return Path(_rebuild(came_from, source, target), best[target])
        settled.add(node)
        for neighbor, edge in graph.neighbors(node).items():
            candidate = best[node] + edge.length_m
            if candidate < best.get(neighbor, float("inf")):
                best[neighbor] = candidate
                came_from[neighbor] = node
                heapq.heappush(queue, (candidate + heuristic(neighbor), neighbor))
    return None


def _rebuild(came_from: dict[int, int], source: int, target: int) -> tuple[int, ...]:
    nodes = [target]
    while nodes[-1] != source:
        nodes.append(came_from[nodes[-1]])
    return tuple(reversed(nodes))


class DijkstraPathFinder:
    name = "dijkstra"

    def find(self, graph: RoadGraph, source: int, target: int) -> Path | None:
        return _search(graph, source, target, lambda _node: 0.0)


class AStarPathFinder:
    name = "a_star"

    def find(self, graph: RoadGraph, source: int, target: int) -> Path | None:
        goal = graph.point(target)
        return _search(graph, source, target, lambda node: haversine_m(graph.point(node), goal))


PATH_FINDERS: dict[str, PathFinder] = {
    finder.name: finder for finder in (DijkstraPathFinder(), AStarPathFinder())
}
