from dataclasses import dataclass

from app.geo import Point, haversine_m


@dataclass(frozen=True)
class Edge:
    length_m: float
    shape: tuple[Point, ...] | None = None


class RoadGraph:
    """Grafo dirigido de calles. No sabe de dónde salió (OSM, un test, otra fuente)."""

    def __init__(self) -> None:
        self._coords: dict[int, Point] = {}
        self._edges: dict[int, dict[int, Edge]] = {}

    def add_node(self, node: int, point: Point) -> None:
        self._coords[node] = point
        self._edges.setdefault(node, {})

    def add_edge(self, u: int, v: int, length_m: float, shape: tuple[Point, ...] | None = None) -> None:
        if u not in self._coords or v not in self._coords:
            raise ValueError(f"Arista {u}->{v} con nodos inexistentes")
        if length_m < 0:
            raise ValueError("La longitud no puede ser negativa")
        current = self._edges[u].get(v)
        if current is None or length_m < current.length_m:
            self._edges[u][v] = Edge(length_m, shape)

    def point(self, node: int) -> Point:
        return self._coords[node]

    def neighbors(self, node: int) -> dict[int, Edge]:
        return self._edges[node]

    def edge(self, u: int, v: int) -> Edge:
        return self._edges[u][v]

    def nearest_node(self, point: Point) -> int:
        if not self._coords:
            raise ValueError("El grafo está vacío")
        return min(self._coords, key=lambda n: haversine_m(self._coords[n], point))
