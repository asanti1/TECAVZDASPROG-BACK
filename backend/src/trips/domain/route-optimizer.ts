import type { RoutePlanRequest } from './route-plan.js';

export interface IRouteOptimizer {
  requestRoutePlan(request: RoutePlanRequest): Promise<void>;
}


export const ROUTE_OPTIMIZER = Symbol('IRouteOptimizer');
