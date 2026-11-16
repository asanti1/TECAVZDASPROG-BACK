from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000.0

Point = tuple[float, float]  # (latitud, longitud)


def haversine_m(a: Point, b: Point) -> float:
    lat1, lon1 = map(radians, a)
    lat2, lon2 = map(radians, b)
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(h))
