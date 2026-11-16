from dataclasses import dataclass
from math import ceil
from typing import Protocol

from app.geo import Point
from app.graph import RoadGraph
from app.ordering import StopOrderer, TwoOptOrderer
from app.pathfinding import Path, PathFinder


class UnreachableStopError(Exception):
    pass


class GraphProvider(Protocol):
    def graph_for(self, points: list[Point]) -> RoadGraph: ...


@dataclass(frozen=True)
class Stop:
    order_id: str
    location: Point


class RoutePlanner:
    def __init__(
        self,
        graphs: GraphProvider,
        finder: PathFinder,
        average_speed_kmh: float,
        orderer: StopOrderer | None = None,
    ) -> None:
        if average_speed_kmh <= 0:
            raise ValueError("La velocidad promedio debe ser positiva")
        self._graphs = graphs
        self._finder = finder
        self._speed_kmh = average_speed_kmh
        self._orderer = orderer or TwoOptOrderer()

    def plan(self, trip_id: str, origin: Point, stops: list[Stop]) -> dict:
        if not stops:
            raise ValueError("El viaje no tiene paradas")
        graph = self._graphs.graph_for([origin, *(s.location for s in stops)])
        nodes = {s.order_id: graph.nearest_node(s.location) for s in stops}
        cache: dict[tuple[int, int], Path] = {}

        def path(a: int, b: int) -> Path:
            if (a, b) not in cache:
                found = self._finder.find(graph, a, b)
                if found is None:
                    raise UnreachableStopError(f"No hay camino entre los nodos {a} y {b}")
                cache[(a, b)] = found
            return cache[(a, b)]

        origin_node = graph.nearest_node(origin)
        node_of = [origin_node, *(nodes[s.order_id] for s in stops)]
        order = self._orderer.order(
            len(stops), lambda a, b: path(node_of[a], node_of[b]).distance_m
        )

        legs = []
        position, position_point = origin_node, origin
        for sequence, index in enumerate(order, start=1):
            stop = stops[index - 1]
            found = path(position, nodes[stop.order_id])
            legs.append(self._leg(graph, sequence, stop, found, position_point))
            position, position_point = nodes[stop.order_id], stop.location
        return {"tripId": trip_id, "legs": legs}

    def _leg(self, graph: RoadGraph, sequence: int, stop: Stop, path: Path, start: Point) -> dict:
        distance_km = path.distance_m / 1000
        return {
            "sequenceOrder": sequence,
            "toOrderId": stop.order_id,
            "geometry": [
                {"latitude": lat, "longitude": lon}
                for lat, lon in [start, *_street_points(graph, path), stop.location]
            ],
            "distanceKm": round(distance_km, 3),
            "estimatedTimeMin": ceil(distance_km / self._speed_kmh * 60),
            "algorithmUsed": self._finder.name,
        }


def _street_points(graph: RoadGraph, path: Path) -> list[Point]:
    points = [graph.point(path.nodes[0])]
    for u, v in zip(path.nodes, path.nodes[1:]):
        shape = graph.edge(u, v).shape
        points.extend(shape[1:] if shape else [graph.point(v)])
    return points
