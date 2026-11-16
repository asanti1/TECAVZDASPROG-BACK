import { InvalidRoutePlanError, InvalidTripError, InvalidTripTransitionError } from '../../shared/errors.js';
import { Route } from './route.js';
import { TripStatus } from './trip-status.js';
import { Trip, type TripProps } from './trip.js';

const leg = (sequenceOrder: number, toOrderId: string): Route =>
  new Route({
    sequenceOrder,
    toOrderId,
    geometry: [
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 1 },
    ],
    distanceKm: 10,
    estimatedTimeMin: 15,
    algorithmUsed: 'dijkstra',
  });

const props = (overrides: Partial<TripProps> = {}): TripProps => ({
  id: 't1',
  deliveryPersonId: 'd1',
  originBranchId: 'b1',
  orderIds: ['o1', 'o2'],
  ...overrides,
});

const plan = (legs: Route[], tripId = 't1') => ({ tripId, legs });
const goodLegs = () => [leg(1, 'o1'), leg(2, 'o2')];
const departure = new Date('2026-01-01T10:00:00Z');

describe('Trip: creación', () => {
  it('nace planned, sin salida ni rutas', () => {
    const trip = new Trip(props());
    expect(trip.status).toBe(TripStatus.PLANNED);
    expect(trip.departureAt).toBeNull();
    expect(trip.routes).toEqual([]);
  });

  it('rechaza viaje sin pedidos', () => {
    expect(() => new Trip(props({ orderIds: [] }))).toThrow(InvalidTripError);
  });

  it('rechaza pedidos repetidos', () => {
    expect(() => new Trip(props({ orderIds: ['o1', 'o1'] }))).toThrow(InvalidTripError);
  });
});

describe('Trip: consistencia al reconstruir (como viene de la base)', () => {
  it('planned no puede tener fecha de salida', () => {
    expect(() => new Trip(props({ departureAt: departure }))).toThrow(InvalidTripError);
  });

  it('in_progress requiere rutas', () => {
    expect(() => new Trip(props({ status: TripStatus.IN_PROGRESS, departureAt: departure }))).toThrow(InvalidTripError);
  });

  it('reconstruye un viaje in_progress válido y ordena los tramos', () => {
    const trip = new Trip(
      props({
        status: TripStatus.IN_PROGRESS,
        departureAt: departure,
        routes: [leg(2, 'o2'), leg(1, 'o1')],
      }),
    );
    expect(trip.routes.map((r) => r.sequenceOrder)).toEqual([1, 2]);
  });
});

describe('Trip.attachRoutePlan', () => {
  it('guarda los tramos ordenados y devuelve true', () => {
    const trip = new Trip(props());
    expect(trip.attachRoutePlan(plan([leg(2, 'o2'), leg(1, 'o1')]))).toBe(true);
    expect(trip.routes.map((r) => r.toOrderId)).toEqual(['o1', 'o2']);
  });

  it('es idempotente: un segundo plan se ignora y no cambia nada', () => {
    const trip = new Trip(props());
    trip.attachRoutePlan(plan(goodLegs()));
    const other = [leg(1, 'o2'), leg(2, 'o1')];
    expect(trip.attachRoutePlan(plan(other))).toBe(false);
    expect(trip.routes.map((r) => r.toOrderId)).toEqual(['o1', 'o2']);
  });

  it('rechaza un plan de otro viaje', () => {
    const trip = new Trip(props());
    expect(() => trip.attachRoutePlan(plan(goodLegs(), 'otro'))).toThrow(InvalidRoutePlanError);
    expect(trip.routes).toEqual([]);
  });

  it('rechaza cantidad de tramos distinta a la de pedidos', () => {
    const trip = new Trip(props());
    expect(() => trip.attachRoutePlan(plan([leg(1, 'o1')]))).toThrow(InvalidRoutePlanError);
    expect(() => trip.attachRoutePlan(plan([leg(1, 'o1'), leg(2, 'o2'), leg(3, 'o1')]))).toThrow(InvalidRoutePlanError);
  });

  it('rechaza un pedido ajeno al viaje', () => {
    const trip = new Trip(props());
    expect(() => trip.attachRoutePlan(plan([leg(1, 'o1'), leg(2, 'x')]))).toThrow(InvalidRoutePlanError);
  });

  it('un plan inválido no deja el viaje a medias: un plan válido posterior sí se acepta', () => {
    const trip = new Trip(props());
    expect(() => trip.attachRoutePlan(plan([leg(1, 'o1')]))).toThrow(InvalidRoutePlanError);
    expect(trip.attachRoutePlan(plan(goodLegs()))).toBe(true);
  });
});

describe('Trip: transiciones', () => {
  const withRoutes = (): Trip => {
    const trip = new Trip(props());
    trip.attachRoutePlan(plan(goodLegs()));
    return trip;
  };

  it('planned -> in_progress -> completed', () => {
    const trip = withRoutes();
    trip.start(departure);
    expect(trip.status).toBe(TripStatus.IN_PROGRESS);
    expect(trip.departureAt).toEqual(departure);
    trip.complete();
    expect(trip.status).toBe(TripStatus.COMPLETED);
  });

  it('no inicia sin rutas calculadas', () => {
    const trip = new Trip(props());
    expect(() => trip.start(departure)).toThrow(InvalidTripTransitionError);
    expect(trip.status).toBe(TripStatus.PLANNED);
    expect(trip.departureAt).toBeNull();
  });

  it('no se inicia dos veces', () => {
    const trip = withRoutes();
    trip.start(departure);
    expect(() => trip.start(departure)).toThrow(InvalidTripTransitionError);
  });

  it('no se completa desde planned', () => {
    expect(() => withRoutes().complete()).toThrow(InvalidTripTransitionError);
  });
});
