import logging

import osmnx as ox

from app.amqp import AmqpWorker
from app.config import Config
from app.handler import RouteRequestHandler
from app.map_store import StoredMapProvider
from app.osm_graph import OsmnxMapSource
from app.pathfinding import PATH_FINDERS
from app.planner import RoutePlanner

log = logging.getLogger(__name__)


def build_map_provider(config: Config) -> StoredMapProvider:
    if config.overpass_url:
        ox.settings.overpass_url = config.overpass_url
        log.info("Usando servidor Overpass: %s", config.overpass_url)
    return StoredMapProvider(OsmnxMapSource(), config.map_file, config.map_bbox, config.map_max_age_days)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    config = Config.from_env()
    if config.algorithm not in PATH_FINDERS:
        raise SystemExit(f"ROUTING_ALGORITHM inválido: {config.algorithm} (opciones: {sorted(PATH_FINDERS)})")
    maps = build_map_provider(config)
    maps.prepare()  # mapa listo antes de aceptar pedidos; si está viejo se refresca en segundo plano
    planner = RoutePlanner(maps, PATH_FINDERS[config.algorithm], config.average_speed_kmh)
    AmqpWorker(config, lambda publish: RouteRequestHandler(planner, publish)).run_forever()


if __name__ == "__main__":
    main()
