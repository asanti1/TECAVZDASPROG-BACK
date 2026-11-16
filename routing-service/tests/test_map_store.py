import os

import networkx as nx
import pytest

from app.map_store import OutOfCoverageError, StoredMapProvider
from app.osm_graph import OsmnxMapSource

BBOX = (-62.40, -38.85, -62.10, -38.62)
DENTRO = (-38.72, -62.27)


def raw_map(length: float = 250.0):
    raw = nx.MultiDiGraph(crs="EPSG:4326")
    raw.add_node(1, y=-38.70, x=-62.30)
    raw.add_node(2, y=-38.71, x=-62.29)
    raw.add_edge(1, 2, length=length)
    raw.add_edge(2, 1, length=length)
    return raw


class FakeSource(OsmnxMapSource):
    def __init__(self):
        self.downloads = 0
        self.fail = False
        self.length = 250.0

    def download(self, bbox):
        self.downloads += 1
        if self.fail:
            raise ConnectionError("sin internet")
        return raw_map(self.length)


def provider(tmp_path, source, now=lambda: 1_000_000.0, max_age_days=15):
    return StoredMapProvider(source, str(tmp_path / "map.graphml"), BBOX, max_age_days, now)


def test_la_primera_vez_descarga_y_guarda_el_mapa(tmp_path):
    source = FakeSource()

    graph = provider(tmp_path, source).graph_for([DENTRO])

    assert source.downloads == 1
    assert (tmp_path / "map.graphml").exists()
    assert graph.edge(1, 2).length_m == 250.0


def test_con_el_archivo_ya_guardado_no_vuelve_a_descargar(tmp_path):
    source = FakeSource()
    provider(tmp_path, source).graph_for([DENTRO])

    reiniciado = provider(tmp_path, source)  # como reiniciar el servicio
    graph = reiniciado.graph_for([DENTRO])

    assert source.downloads == 1
    assert graph.point(1) == (-38.70, -62.30)


def test_un_mapa_viejo_se_sigue_usando_y_se_refresca(tmp_path):
    source = FakeSource()
    provider(tmp_path, source).prepare(background=False)
    path = tmp_path / "map.graphml"
    veinte_dias = os.path.getmtime(path) + 20 * 86_400

    source.length = 400.0
    viejo = provider(tmp_path, source, now=lambda: veinte_dias)
    viejo.prepare(background=False)

    assert source.downloads == 2
    assert viejo.graph_for([DENTRO]).edge(1, 2).length_m == 400.0


def test_un_mapa_reciente_no_se_refresca(tmp_path):
    source = FakeSource()
    provider(tmp_path, source).prepare(background=False)
    path = tmp_path / "map.graphml"

    provider(tmp_path, source, now=lambda: os.path.getmtime(path) + 86_400).prepare(background=False)

    assert source.downloads == 1


def test_si_el_refresco_falla_sigue_sirviendo_el_mapa_viejo(tmp_path):
    source = FakeSource()
    provider(tmp_path, source).prepare(background=False)
    veinte_dias = os.path.getmtime(tmp_path / "map.graphml") + 20 * 86_400

    source.fail = True
    viejo = provider(tmp_path, source, now=lambda: veinte_dias)
    viejo.prepare(background=False)

    assert viejo.graph_for([DENTRO]).edge(1, 2).length_m == 250.0
    assert not (tmp_path / "map.graphml.tmp").exists()


def test_sin_mapa_y_sin_internet_falla_con_un_error_reintentable(tmp_path):
    source = FakeSource()
    source.fail = True

    with pytest.raises(RuntimeError):
        provider(tmp_path, source).graph_for([DENTRO])


def test_un_punto_fuera_de_la_zona_se_rechaza_sin_descargar(tmp_path):
    source = FakeSource()

    with pytest.raises(OutOfCoverageError):
        provider(tmp_path, source).graph_for([DENTRO, (-34.60, -58.38)])  # Buenos Aires

    assert source.downloads == 0
