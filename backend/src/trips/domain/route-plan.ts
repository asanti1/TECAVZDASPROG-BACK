import type { Coordinates } from '../../shared/geo/coordinates.js';
import type { Route } from './route.js';

export interface PlanStop {
  orderId: string;
  location: Coordinates;
}


export interface RoutePlanRequest {
  tripId: string;
  origin: Coordinates;
  stops: ReadonlyArray<PlanStop>;
}

export interface RoutePlan {
  tripId: string;
  legs: ReadonlyArray<Route>;
}
