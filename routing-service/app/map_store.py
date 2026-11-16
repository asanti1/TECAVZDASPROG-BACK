import logging
import os
import threading
import time
from typing import Callable, Protocol

from app.geo import Point
from app.graph import RoadGraph
from app.osm_graph import BBox, to_road_graph

log = logging.getLogger(__name__)

SECONDS_PER_DAY = 86_400


class OutOfCoverageError(ValueError):
    pass

class MapSource(Protocol):
    def download(self, bbox: BBox): ...

    def save(self, raw, path: str) -> None: ...

    def load(self, path: str): ...


class StoredMapProvider:
    def __init__(
        self,
        source: MapSource,
        path: str,
        bbox: BBox,
        max_age_days: float,
        now: Callable[[], float] = time.time,
    ) -> None:
        self._source = source
        self._path = path
        self._bbox = bbox
        self._max_age_s = max_age_days * SECONDS_PER_DAY
        self._now = now
        self._graph: RoadGraph | None = None
        self._lock = threading.Lock()

    def prepare(self, background: bool = True) -> None:
        """Deja el mapa listo al arrancar; si está viejo, lo refresca sin bloquear."""
        try:
            self._ensure_loaded()
        except Exception as error:
            log.error("No se pudo preparar el mapa; se reintentará con el primer pedido: %r", error)
            return
        if self._is_stale():
            if background:
                threading.Thread(target=self.refresh, daemon=True, name="map-refresh").start()
            else:
                self.refresh()

    def refresh(self) -> bool:
        """Baja el mapa de nuevo. Si falla, conserva el actual."""
        log.info("Descargando el mapa de la zona %s ...", self._bbox)
        try:
            raw = self._source.download(self._bbox)
            self._write(raw)
            graph = to_road_graph(raw)
        except Exception as error:
            log.warning("No se pudo actualizar el mapa, se sigue con el actual: %r", error)
            return False
        with self._lock:
            self._graph = graph
        log.info("Mapa listo: guardado en %s", self._path)
        return True

    def graph_for(self, points: list[Point]) -> RoadGraph:
        for point in points:
            if not self._covers(point):
                raise OutOfCoverageError(f"El punto {point} está fuera de la zona de mapa disponible {self._bbox}")
        return self._ensure_loaded()

    def _ensure_loaded(self) -> RoadGraph:
        with self._lock:
            if self._graph is not None:
                return self._graph
        if os.path.exists(self._path):
            graph = to_road_graph(self._source.load(self._path))
            with self._lock:
                self._graph = graph
            log.info("Mapa cargado desde %s", self._path)
            return graph
        if not self.refresh():
            raise RuntimeError("No hay mapa local y no se pudo descargar")
        with self._lock:
            assert self._graph is not None
            return self._graph

    def _is_stale(self) -> bool:
        return self._now() - os.path.getmtime(self._path) > self._max_age_s

    def _covers(self, point: Point) -> bool:
        west, south, east, north = self._bbox
        lat, lon = point
        return south <= lat <= north and west <= lon <= east

    def _write(self, raw) -> None:
        os.makedirs(os.path.dirname(self._path) or ".", exist_ok=True)
        temporary = f"{self._path}.tmp"
        self._source.save(raw, temporary)
        os.replace(temporary, self._path)