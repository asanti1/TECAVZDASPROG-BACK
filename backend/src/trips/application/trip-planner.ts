import { Inject, Injectable } from '@nestjs/common';
import type { Branch } from '../../branches/domain/branch.js';
import { Order } from '../../orders/domain/order.js';
import { OrderStatus } from '../../orders/domain/order-status.js';
import { InvalidTripError } from '../../shared/errors.js';
import type { Coordinates } from '../../shared/geo/coordinates.js';
import { ID_GENERATOR } from '../../shared/id-generator.js';
import type { IIdGenerator } from '../../shared/id-generator.js';
import { ROUTE_OPTIMIZER } from '../domain/route-optimizer.js';
import type { IRouteOptimizer } from '../domain/route-optimizer.js';
import type { RoutePlanRequest } from '../domain/route-plan.js';
import { Trip } from '../domain/trip.js';

export interface PlanTripStop {
  order: Order;
  location: Coordinates;
}

export interface PlanTripInput {
  deliveryPersonId: string;
  origin: Branch;
  stops: ReadonlyArray<PlanTripStop>;
}

export interface PlannedTrip {
  trip: Trip;
  request: RoutePlanRequest;
}


@Injectable()
export class TripPlanner {
  constructor(
    @Inject(ROUTE_OPTIMIZER) private readonly routeOptimizer: IRouteOptimizer,
    @Inject(ID_GENERATOR) private readonly ids: IIdGenerator,
  ) { }

  planTrip(input: PlanTripInput): PlannedTrip {
    this.assertPlannable(input);

    const trip = new Trip({
      id: this.ids.newId(),
      deliveryPersonId: input.deliveryPersonId,
      originBranchId: input.origin.id,
      orderIds: input.stops.map(({ order }) => order.id),
    });
    for (const { order } of input.stops) {
      order.assignToTrip(trip.id);
    }

    return {
      trip,
      request: this.buildRequest(trip.id, input.origin, input.stops),
    };
  }

  buildRequest(
    tripId: string,
    origin: Branch,
    stops: ReadonlyArray<PlanTripStop>,
  ): RoutePlanRequest {
    return {
      tripId,
      origin: origin.location,
      stops: stops.map(({ order, location }) => ({
        orderId: order.id,
        location,
      })),
    };
  }

  requestRoutes(planned: PlannedTrip): Promise<void> {
    return this.routeOptimizer.requestRoutePlan(planned.request);
  }

  private assertPlannable({ origin, stops }: PlanTripInput): void {
    if (stops.length === 0) {
      throw new InvalidTripError('Un viaje necesita al menos un pedido');
    }
    const seen = new Set<string>();
    for (const { order } of stops) {
      if (seen.has(order.id)) {
        throw new InvalidTripError(`El pedido ${order.id} está repetido`);
      }
      seen.add(order.id);
      if (order.status !== OrderStatus.PENDING) {
        throw new InvalidTripError(
          `El pedido ${order.id} está '${order.status}': solo se agrupan pedidos pending`,
        );
      }
      if (order.originBranchId !== origin.id) {
        throw new InvalidTripError(
          `El pedido ${order.id} sale de otra sucursal (${order.originBranchId}, no ${origin.id})`,
        );
      }
    }
  }
}
