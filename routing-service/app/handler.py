import json
import logging
from enum import Enum
from typing import Callable

from app.geo import Point
from app.planner import RoutePlanner, Stop, UnreachableStopError

log = logging.getLogger(__name__)


class Outcome(Enum):
    ACK = "ack"
    REJECT = "reject"
    RETRY = "retry"


class RouteRequestHandler:
    """Procesa un pedido de ruta. No conoce RabbitMQ: recibe bytes y un `publish`."""

    def __init__(self, planner: RoutePlanner, publish: Callable[[bytes], None]) -> None:
        self._planner = planner
        self._publish = publish
        self._done: set[str] = set()

    def handle(self, body: bytes, redelivered: bool) -> Outcome:
        try:
            trip_id, origin, stops = _parse(body)
        except (ValueError, KeyError, TypeError) as error:
            log.error("Pedido inválido, se descarta: %r", error)
            return Outcome.REJECT

        if trip_id in self._done:
            log.warning("Pedido repetido del viaje %s: se ignora", trip_id)
            return Outcome.ACK

        try:
            plan = self._planner.plan(trip_id, origin, stops)
        except Exception as error:
            return self._failure(trip_id, error, redelivered, permanent=_is_permanent(error))

        try:
            self._publish(json.dumps(plan).encode("utf-8"))
        except Exception as error:
            return self._failure(trip_id, error, redelivered, permanent=False)

        self._done.add(trip_id)
        return Outcome.ACK

    @staticmethod
    def _failure(trip_id: str, error: Exception, redelivered: bool, permanent: bool) -> Outcome:
        if permanent or redelivered:
            log.error("Viaje %s descartado: %r", trip_id, error)
            return Outcome.REJECT
        log.warning("Viaje %s: falla transitoria, se reintenta: %r", trip_id, error)
        return Outcome.RETRY


def _is_permanent(error: Exception) -> bool:
    return isinstance(error, (UnreachableStopError, ValueError))


def _point(raw: dict) -> Point:
    return float(raw["latitude"]), float(raw["longitude"])


def _parse(body: bytes) -> tuple[str, Point, list[Stop]]:
    message = json.loads(body)
    trip_id = message["tripId"]
    if not isinstance(trip_id, str) or not trip_id:
        raise ValueError("tripId inválido")
    stops = [Stop(str(s["orderId"]), _point(s["location"])) for s in message["stops"]]
    if not stops:
        raise ValueError("El pedido no tiene paradas")
    return trip_id, _point(message["origin"]), stops
