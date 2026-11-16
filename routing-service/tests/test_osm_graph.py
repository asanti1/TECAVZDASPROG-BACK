import networkx as nx
from shapely.geometry import LineString

from app.osm_graph import to_road_graph


def test_convierte_un_grafo_de_osmnx_conservando_sentido_largo_y_curvas():
    raw = nx.MultiDiGraph()
    raw.add_node(1, y=-38.70, x=-62.30)
    raw.add_node(2, y=-38.71, x=-62.29)
    curva = LineString([(-62.30, -38.70), (-62.295, -38.708), (-62.29, -38.71)])  # (lon, lat)
    raw.add_edge(1, 2, length=250.0, geometry=curva)
    raw.add_edge(1, 2, length=300.0)

    graph = to_road_graph(raw)

    assert graph.point(1) == (-38.70, -62.30)
    assert graph.edge(1, 2).length_m == 250.0
    assert graph.edge(1, 2).shape == ((-38.70, -62.30), (-38.708, -62.295), (-38.71, -62.29))
    assert graph.neighbors(2) == {}


def test_el_servidor_overpass_alternativo_sale_del_entorno():
    from app.config import Config

    assert Config.from_env({}).overpass_url is None
    assert Config.from_env({"OVERPASS_URL": ""}).overpass_url is None
    assert Config.from_env({"OVERPASS_URL": "https://espejo.example/api"}).overpass_url == "https://espejo.example/api"


def test_la_zona_del_mapa_se_configura_y_se_valida():
    import pytest

    from app.config import Config

    assert Config.from_env({"MAP_BBOX": "-62.5,-38.9,-62.0,-38.5"}).map_bbox == (-62.5, -38.9, -62.0, -38.5)
    with pytest.raises(ValueError):
        Config.from_env({"MAP_BBOX": "1,2,3"})
    with pytest.raises(ValueError):
        Config.from_env({"MAP_BBOX": "-62.0,-38.9,-62.5,-38.5"})
