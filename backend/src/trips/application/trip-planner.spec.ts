import { Test } from '@nestjs/testing';
import type { Branch } from '../../branches/domain/branch.js';
import { OrderStatus, OrderType } from '../../orders/domain/order-status.js';
import { Order } from '../../orders/domain/order.js';
import { InvalidTripError } from '../../shared/errors.js';
import { ID_GENERATOR, type IIdGenerator } from '../../shared/id-generator.js';
import { ROUTE_OPTIMIZER, type IRouteOptimizer } from '../domain/route-optimizer.js';
import type { RoutePlanRequest } from '../domain/route-plan.js';
import { TripStatus } from '../domain/trip-status.js';
import { TripPlanner } from './trip-planner.js';

class FakeRouteOptimizer implements IRouteOptimizer {
  readonly requests: RoutePlanRequest[] = [];
  async requestRoutePlan(request: RoutePlanRequest): Promise<void> {
    this.requests.push(request);
  }
}

class SequentialIds implements IIdGenerator {
  private n = 0;
  newId(): string {
    this.n += 1;
    return `trip-${this.n}`;
  }
}

const origin: Branch = {
  id: 'b1',
  name: 'Centro',
  location: { latitude: -34.6, longitude: -58.4 },
};

const customerOrder = (id: string, originBranchId = 'b1'): Order =>
  new Order({
    id,
    type: OrderType.CUSTOMER,
    originBranchId,
    customerId: 'c1',
    deliveryAddress: { latitude: -34.7, longitude: -58.5 },
    items: [{ productId: 'p1', quantity: 1 }],
  });

const stop = (order: Order) => ({
  order,
  location: { latitude: -34.7, longitude: -58.5 },
});

const build = () => {
  const optimizer = new FakeRouteOptimizer();
  const planner = new TripPlanner(optimizer, new SequentialIds());
  return { planner, optimizer };
};

describe('TripPlanner.planTrip', () => {
  it('crea el viaje planned, asigna los pedidos y arma el pedido de rutas', () => {
    const { planner } = build();
    const o1 = customerOrder('o1');
    const o2 = customerOrder('o2');

    const { trip, request } = planner.planTrip({
      deliveryPersonId: 'd1',
      origin,
      stops: [stop(o1), stop(o2)],
    });

    expect(trip.id).toBe('trip-1');
    expect(trip.status).toBe(TripStatus.PLANNED);
    expect(trip.deliveryPersonId).toBe('d1');
    expect(trip.originBranchId).toBe('b1');
    expect(trip.orderIds).toEqual(['o1', 'o2']);
    expect(o1.status).toBe(OrderStatus.ASSIGNED);
    expect(o1.tripId).toBe('trip-1');
    expect(o2.tripId).toBe('trip-1');
    expect(request.tripId).toBe('trip-1');
    expect(request.origin).toEqual(origin.location);
    expect(request.stops.map((s) => s.orderId)).toEqual(['o1', 'o2']);
  });

  it('rechaza pedidos que no están pending', () => {
    const { planner } = build();
    const assigned = customerOrder('o1');
    assigned.assignToTrip('otro');
    expect(() =>
      planner.planTrip({
        deliveryPersonId: 'd1',
        origin,
        stops: [stop(assigned)],
      }),
    ).toThrow(InvalidTripError);
    expect(assigned.tripId).toBe('otro');
  });

  it('rechaza pedidos de otra sucursal', () => {
    const { planner } = build();
    expect(() =>
      planner.planTrip({
        deliveryPersonId: 'd1',
        origin,
        stops: [stop(customerOrder('o1', 'b2'))],
      }),
    ).toThrow(InvalidTripError);
  });

  it('es atómico: si un pedido es inválido, ninguno queda asignado', () => {
    const { planner } = build();
    const good = customerOrder('o1');
    const bad = customerOrder('o2', 'b2');
    expect(() =>
      planner.planTrip({
        deliveryPersonId: 'd1',
        origin,
        stops: [stop(good), stop(bad)],
      }),
    ).toThrow(InvalidTripError);
    expect(good.status).toBe(OrderStatus.PENDING);
    expect(good.tripId).toBeNull();
    expect(bad.status).toBe(OrderStatus.PENDING);
  });
});

describe('TripPlanner.requestRoutes', () => {
  it('publica el pedido de rutas del viaje planificado', async () => {
    const { planner, optimizer } = build();
    const planned = planner.planTrip({
      deliveryPersonId: 'd1',
      origin,
      stops: [stop(customerOrder('o1'))],
    });
    await planner.requestRoutes(planned);
    expect(optimizer.requests).toEqual([planned.request]);
  });

  it('propaga el error si no se puede encolar', async () => {
    const failing: IRouteOptimizer = {
      requestRoutePlan: () => Promise.reject(new Error('rabbit caído')),
    };
    const planner = new TripPlanner(failing, new SequentialIds());
    const planned = planner.planTrip({
      deliveryPersonId: 'd1',
      origin,
      stops: [stop(customerOrder('o1'))],
    });
    await expect(planner.requestRoutes(planned)).rejects.toThrow(
      'rabbit caído',
    );
  });
});

describe('TripPlanner bajo el contenedor de Nest', () => {
  it('recibe las dependencias por token', async () => {
    const optimizer = new FakeRouteOptimizer();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TripPlanner,
        { provide: ROUTE_OPTIMIZER, useValue: optimizer },
        { provide: ID_GENERATOR, useValue: new SequentialIds() },
      ],
    }).compile();

    const planner = moduleRef.get(TripPlanner);
    const planned = planner.planTrip({
      deliveryPersonId: 'd1',
      origin,
      stops: [stop(customerOrder('o1'))],
    });
    await planner.requestRoutes(planned);

    expect(planned.trip.id).toBe('trip-1');
    expect(optimizer.requests).toHaveLength(1);
  });
});
