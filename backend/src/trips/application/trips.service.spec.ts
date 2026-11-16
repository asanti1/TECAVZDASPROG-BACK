import { InMemoryBranchRepository, InMemoryDatabase, InMemoryOrderRepository, InMemoryTripRepository, InMemoryUnitOfWork } from '../../../test/support/in-memory-database.js';
import type { Branch } from '../../branches/domain/branch.js';
import { OrderStatus, OrderType } from '../../orders/domain/order-status.js';
import { Order } from '../../orders/domain/order.js';
import { InvalidTripError, InvalidTripTransitionError, NoDeliveryPersonAvailableError, OrderNotFoundError, TripNotFoundError } from '../../shared/errors.js';
import type { DeliveryCandidate, IDeliveryPeopleAvailability } from '../domain/delivery-assignment.js';
import { FewestTripsDeliveryStrategy } from '../domain/delivery-assignment.js';
import type { IRouteOptimizer } from '../domain/route-optimizer.js';
import type { RoutePlan, RoutePlanRequest } from '../domain/route-plan.js';
import { Route } from '../domain/route.js';
import { TripStatus } from '../domain/trip-status.js';
import { TripPlanner } from './trip-planner.js';
import { TripsService } from './trips.service.js';

const origin: Branch = {
  id: 'b1',
  name: 'Bahía Blanca',
  location: { latitude: -38.7, longitude: -62.3 },
};

const customerOrder = (id: string, latitude: number): Order =>
  new Order({
    id,
    type: OrderType.CUSTOMER,
    originBranchId: origin.id,
    customerId: 'c1',
    deliveryAddress: { latitude, longitude: -62.2 },
    items: [{ productId: 'p1', quantity: 1 }],
  });

const planFor = (tripId: string, orderIds: string[]): RoutePlan => ({
  tripId,
  legs: orderIds.map(
    (toOrderId, index) =>
      new Route({
        sequenceOrder: index + 1,
        toOrderId,
        geometry: [
          { latitude: -38.7, longitude: -62.3 },
          { latitude: -38.6, longitude: -62.2 },
        ],
        distanceKm: 3,
        estimatedTimeMin: 6,
        algorithmUsed: 'dijkstra',
      }),
  ),
});

class RecordingOptimizer implements IRouteOptimizer {
  readonly requests: RoutePlanRequest[] = [];
  failWith: Error | null = null;

  async requestRoutePlan(request: RoutePlanRequest): Promise<void> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.requests.push(request);
  }
}

class FakeAvailability implements IDeliveryPeopleAvailability {
  people: DeliveryCandidate[] = [{ id: 'd1', completedTrips: 0 }];
  readonly asked: string[] = [];

  async findAvailable(branchId: string): Promise<DeliveryCandidate[]> {
    this.asked.push(branchId);
    return this.people;
  }
}

class Fixture {
  readonly availability = new FakeAvailability();
  readonly db = new InMemoryDatabase();
  readonly optimizer = new RecordingOptimizer();
  readonly service: TripsService;
  private nextId = 0;

  constructor() {
    this.db.addBranch(origin, { p1: 10 });
    this.db.addBranch(
      {
        id: 'b2',
        name: 'Destino',
        location: { latitude: -38.5, longitude: -62.1 },
      },
      { p1: 0 },
    );
    this.db.orders.set('o1', customerOrder('o1', -38.6));
    this.db.orders.set('o2', customerOrder('o2', -38.65));
    const planner = new TripPlanner(this.optimizer, {
      newId: () => `trip-${++this.nextId}`,
    });
    this.service = new TripsService(
      new InMemoryTripRepository(this.db),
      new InMemoryOrderRepository(this.db),
      new InMemoryBranchRepository(this.db),
      new InMemoryUnitOfWork(this.db),
      planner,
      this.availability,
      new FewestTripsDeliveryStrategy(),
    );
  }

  input(orderIds = ['o1', 'o2']) {
    return { orderIds };
  }
}

describe('TripsService.createTrip', () => {
  it('guarda el viaje, asigna los pedidos y pide las rutas', async () => {
    const f = new Fixture();

    const trip = await f.service.createTrip(f.input());

    expect(trip.status).toBe(TripStatus.PLANNED);
    expect(f.db.trips.get(trip.id)).toBe(trip);
    expect(f.db.orders.get('o1')?.status).toBe(OrderStatus.ASSIGNED);
    expect(f.db.orders.get('o2')?.tripId).toBe(trip.id);
    expect(f.optimizer.requests).toHaveLength(1);
    expect(f.optimizer.requests[0]).toMatchObject({
      tripId: trip.id,
      origin: origin.location,
    });
    expect(f.optimizer.requests[0]?.stops.map((s) => s.orderId)).toEqual([
      'o1',
      'o2',
    ]);
  });

  it('asigna el repartidor libre de la sucursal de origen de los pedidos', async () => {
    const f = new Fixture();
    f.availability.people = [
      { id: 'd1', completedTrips: 3 },
      { id: 'd2', completedTrips: 1 },
    ];

    const trip = await f.service.createTrip(f.input());

    expect(f.availability.asked).toEqual([origin.id]);
    expect(trip.deliveryPersonId).toBe('d2');
  });

  it('falla sin guardar nada si no hay repartidores libres', async () => {
    const f = new Fixture();
    f.availability.people = [];

    await expect(f.service.createTrip(f.input())).rejects.toThrow(
      NoDeliveryPersonAvailableError,
    );

    expect(f.db.trips.size).toBe(0);
    expect(f.db.orders.get('o1')?.status).toBe(OrderStatus.PENDING);
    expect(f.optimizer.requests).toHaveLength(0);
  });

  it('rechaza pedidos que salen de sucursales distintas', async () => {
    const f = new Fixture();
    f.db.orders.set(
      'o9',
      new Order({
        id: 'o9',
        type: OrderType.CUSTOMER,
        originBranchId: 'b2',
        customerId: 'c1',
        deliveryAddress: { latitude: -38.6, longitude: -62.2 },
        items: [{ productId: 'p1', quantity: 1 }],
      }),
    );

    await expect(f.service.createTrip(f.input(['o1', 'o9']))).rejects.toThrow(
      InvalidTripError,
    );

    expect(f.db.trips.size).toBe(0);
  });

  it('usa la ubicación de la sucursal como parada de un pedido entre sucursales', async () => {
    const f = new Fixture();
    f.db.orders.set(
      'o3',
      new Order({
        id: 'o3',
        type: OrderType.INTER_BRANCH,
        originBranchId: origin.id,
        destinationBranchId: 'b2',
        items: [{ productId: 'p1', quantity: 1 }],
      }),
    );

    await f.service.createTrip(f.input(['o3']));

    expect(f.optimizer.requests[0]?.stops[0]?.location).toEqual({
      latitude: -38.5,
      longitude: -62.1,
    });
  });

  it('si falla el pedido de rutas, el viaje queda guardado y planificado', async () => {
    const f = new Fixture();
    f.optimizer.failWith = new Error('rabbit caído');

    const trip = await f.service.createTrip(f.input());

    expect(f.db.trips.get(trip.id)?.status).toBe(TripStatus.PLANNED);
    expect(f.db.orders.get('o1')?.status).toBe(OrderStatus.ASSIGNED);
  });

  it('no guarda nada si un pedido no existe', async () => {
    const f = new Fixture();

    await expect(f.service.createTrip(f.input(['o1', 'nope']))).rejects.toThrow(
      OrderNotFoundError,
    );

    expect(f.db.trips.size).toBe(0);
    expect(f.db.orders.get('o1')?.status).toBe(OrderStatus.PENDING);
    expect(f.optimizer.requests).toHaveLength(0);
  });

  it('si falla al guardar los pedidos, revierte también el viaje', async () => {
    const f = new Fixture();
    const failing = new InMemoryOrderRepository(f.db);
    failing.save = () => Promise.reject(new Error('disco'));
    const service = new TripsService(
      new InMemoryTripRepository(f.db),
      failing,
      new InMemoryBranchRepository(f.db),
      new InMemoryUnitOfWork(f.db),
      new TripPlanner(f.optimizer, { newId: () => 'trip-x' }),
      f.availability,
      new FewestTripsDeliveryStrategy(),
    );

    await expect(service.createTrip(f.input())).rejects.toThrow('disco');

    expect(f.db.trips.size).toBe(0);
    expect(f.optimizer.requests).toHaveLength(0);
  });
});

describe('TripsService.attachRoutePlan', () => {
  it('guarda las rutas y ignora un resultado duplicado', async () => {
    const f = new Fixture();
    const trip = await f.service.createTrip(f.input());
    const plan = planFor(trip.id, ['o1', 'o2']);

    expect(await f.service.attachRoutePlan(plan)).toBe(true);
    expect(await f.service.attachRoutePlan(plan)).toBe(false);

    expect(f.db.trips.get(trip.id)?.routes).toHaveLength(2);
  });
});

describe('TripsService.requestRoutesAgain', () => {
  it('vuelve a pedir las rutas de un viaje sin rutas', async () => {
    const f = new Fixture();
    f.optimizer.failWith = new Error('caído');
    const trip = await f.service.createTrip(f.input());
    f.optimizer.failWith = null;

    await f.service.requestRoutesAgain(trip.id);

    expect(f.optimizer.requests).toHaveLength(1);
    expect(f.optimizer.requests[0]?.tripId).toBe(trip.id);
  });

  it('rechaza un viaje que ya tiene rutas', async () => {
    const f = new Fixture();
    const trip = await f.service.createTrip(f.input());
    await f.service.attachRoutePlan(planFor(trip.id, ['o1', 'o2']));

    await expect(f.service.requestRoutesAgain(trip.id)).rejects.toThrow(
      InvalidTripTransitionError,
    );
  });
});

describe('TripsService.startTrip / completeTrip', () => {
  it('salir y completar actualizan el viaje y todos sus pedidos', async () => {
    const f = new Fixture();
    const trip = await f.service.createTrip(f.input());
    await f.service.attachRoutePlan(planFor(trip.id, ['o1', 'o2']));
    const at = new Date('2026-11-14T10:00:00Z');

    await f.service.startTrip(trip.id, at);
    expect(f.db.trips.get(trip.id)?.status).toBe(TripStatus.IN_PROGRESS);
    expect(f.db.trips.get(trip.id)?.departureAt).toEqual(at);
    expect(f.db.orders.get('o1')?.status).toBe(OrderStatus.IN_TRIP);

    await f.service.completeTrip(trip.id);
    expect(f.db.trips.get(trip.id)?.status).toBe(TripStatus.COMPLETED);
    expect(f.db.orders.get('o2')?.status).toBe(OrderStatus.DELIVERED);
  });

  it('no puede salir sin rutas y no toca los pedidos', async () => {
    const f = new Fixture();
    const trip = await f.service.createTrip(f.input());

    await expect(f.service.startTrip(trip.id, new Date())).rejects.toThrow();

    expect(f.db.trips.get(trip.id)?.status).toBe(TripStatus.PLANNED);
    expect(f.db.orders.get('o1')?.status).toBe(OrderStatus.ASSIGNED);
  });

  it('falla si el viaje no existe', async () => {
    const f = new Fixture();

    await expect(f.service.completeTrip('nope')).rejects.toThrow(
      TripNotFoundError,
    );
  });
});
