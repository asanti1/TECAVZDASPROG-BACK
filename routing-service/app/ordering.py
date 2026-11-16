from typing import Callable, Protocol

Distance = Callable[[int, int], float]

_EPSILON = 1e-9


class StopOrderer(Protocol):
    def order(self, stop_count: int, distance: Distance) -> list[int]:



def route_cost(order: list[int], distance: Distance) -> float:
    stops = [0, *order]
    return sum(distance(a, b) for a, b in zip(stops, stops[1:]))


class NearestNeighborOrderer:
    def order(self, stop_count: int, distance: Distance) -> list[int]:
        pending = list(range(1, stop_count + 1))
        current, order = 0, []
        while pending:
            nearest = min(pending, key=lambda stop: distance(current, stop))
            pending.remove(nearest)
            order.append(nearest)
            current = nearest
        return order


class TwoOptOrderer:
    def __init__(self, initial: StopOrderer | None = None) -> None:
        self._initial = initial or NearestNeighborOrderer()

    def order(self, stop_count: int, distance: Distance) -> list[int]:
        best = self._initial.order(stop_count, distance)
        best_cost = route_cost(best, distance)
        improved = True
        while improved:
            improved = False
            for i in range(len(best) - 1):
                for j in range(i + 1, len(best)):
                    candidate = best[:i] + best[i : j + 1][::-1] + best[j + 1 :]
                    cost = route_cost(candidate, distance)
                    if cost < best_cost - _EPSILON:
                        best, best_cost, improved = candidate, cost, True
        return best
