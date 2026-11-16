from app.geo import Point, haversine_m
from app.graph import RoadGraph

ORIGIN: Point = (-38.7183, -62.2663)
STEP = 0.001  # ~100 m


def grid_graph(size: int = 4) -> RoadGraph:
    graph = RoadGraph()
    for row in range(size):
        for col in range(size):
            graph.add_node(row * size + col, (ORIGIN[0] + row * STEP, ORIGIN[1] + col * STEP))
    for row in range(size):
        for col in range(size):
            node = row * size + col
            for dr, dc in ((0, 1), (1, 0)):
                r, c = row + dr, col + dc
                if r < size and c < size:
                    other = r * size + c
                    length = haversine_m(graph.point(node), graph.point(other))
                    graph.add_edge(node, other, length)
                    graph.add_edge(other, node, length)
    return graph


class FixedGraph:
    def __init__(self, graph: RoadGraph) -> None:
        self._graph = graph

    def graph_for(self, points):
        return self._graph
