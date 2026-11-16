import osmnx as ox

from app.graph import RoadGraph

BBox = tuple[float, float, float, float]


class OsmnxMapSource:
    def download(self, bbox: BBox):
        raw = ox.graph_from_bbox(bbox, network_type="drive")
        return ox.truncate.largest_component(raw, strongly=True)

    def save(self, raw, path: str) -> None:
        ox.save_graphml(raw, path)

    def load(self, path: str):
        return ox.load_graphml(path)


def to_road_graph(raw) -> RoadGraph:
    graph = RoadGraph()
    for node, data in raw.nodes(data=True):
        graph.add_node(node, (data["y"], data["x"]))
    for u, v, data in raw.edges(data=True):
        geometry = data.get("geometry")
        shape = tuple((lat, lon) for lon, lat in geometry.coords) if geometry is not None else None
        graph.add_edge(u, v, float(data["length"]), shape)
    return graph
