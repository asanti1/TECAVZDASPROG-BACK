import os
from dataclasses import dataclass


# Bahía Blanca y alrededores (~26 x 26 km): oeste,sur,este,norte
DEFAULT_BBOX = "-62.40,-38.85,-62.10,-38.62"


def _parse_bbox(raw: str) -> tuple[float, float, float, float]:
    parts = [float(part) for part in raw.split(",")]
    if len(parts) != 4:
        raise ValueError("MAP_BBOX debe ser 'oeste,sur,este,norte'")
    west, south, east, north = parts
    if not (west < east and south < north):
        raise ValueError("MAP_BBOX: el oeste debe ser menor que el este y el sur menor que el norte")
    return west, south, east, north


@dataclass(frozen=True)
class Config:
    host: str
    port: int
    user: str
    password: str
    average_speed_kmh: float
    algorithm: str
    map_bbox: tuple[float, float, float, float]
    map_file: str
    map_max_age_days: float
    overpass_url: str | None

    @staticmethod
    def from_env(env: dict[str, str] | None = None) -> "Config":
        env = dict(os.environ) if env is None else env
        return Config(
            host=env.get("RABBITMQ_HOST", "localhost"),
            port=int(env.get("RABBITMQ_PORT", "5672")),
            user=env.get("RABBITMQ_ROUTER_USER", "router"),
            password=env.get("RABBITMQ_ROUTER_PASSWORD", "router_dev"),
            average_speed_kmh=float(env.get("AVERAGE_SPEED_KMH", "30")),
            algorithm=env.get("ROUTING_ALGORITHM", "dijkstra"),
            map_bbox=_parse_bbox(env.get("MAP_BBOX") or DEFAULT_BBOX),
            map_file=env.get("MAP_FILE", "cache/map.graphml"),
            map_max_age_days=float(env.get("MAP_MAX_AGE_DAYS", "15")),
            overpass_url=env.get("OVERPASS_URL") or None,
        )
