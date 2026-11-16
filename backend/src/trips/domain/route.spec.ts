import { InvalidRouteError } from '../../shared/errors.js';
import { Route, type RouteProps } from './route.js';

const geometry = [
  { latitude: -34.6, longitude: -58.4 },
  { latitude: -34.7, longitude: -58.5 },
];

const props = (overrides: Partial<RouteProps> = {}): RouteProps => ({
  sequenceOrder: 1,
  toOrderId: 'o1',
  geometry,
  distanceKm: 12.5,
  estimatedTimeMin: 20,
  algorithmUsed: 'dijkstra',
  ...overrides,
});

describe('Route', () => {
  it('crea un tramo válido', () => {
    const route = new Route(props());
    expect(route.sequenceOrder).toBe(1);
    expect(route.toOrderId).toBe('o1');
    expect(route.distanceKm).toBe(12.5);
    expect(route.estimatedTimeMin).toBe(20);
    expect(route.algorithmUsed).toBe('dijkstra');
    expect(route.geometry).toEqual(geometry);
  });

  it('acepta distancia y tiempo en cero', () => {
    expect(
      () => new Route(props({ distanceKm: 0, estimatedTimeMin: 0 })),
    ).not.toThrow();
  });

  it.each([0, 1.5])('rechaza sequenceOrder %s', (sequenceOrder) => {
    expect(() => new Route(props({ sequenceOrder }))).toThrow(
      InvalidRouteError,
    );
  });

  it('rechaza destino vacío', () => {
    expect(() => new Route(props({ toOrderId: '  ' }))).toThrow(
      InvalidRouteError,
    );
  });

  it('rechaza geometría con menos de 2 puntos', () => {
    expect(() => new Route(props({ geometry: [] }))).toThrow(InvalidRouteError);
    expect(() => new Route(props({ geometry: [geometry[0]!] }))).toThrow(
      InvalidRouteError,
    );
  });

  it.each([-1, Number.NaN])('rechaza distancia %s', (distanceKm) => {
    expect(() => new Route(props({ distanceKm }))).toThrow(InvalidRouteError);
  });

  it.each([-1, 1.5])('rechaza tiempo estimado %s', (estimatedTimeMin) => {
    expect(() => new Route(props({ estimatedTimeMin }))).toThrow(
      InvalidRouteError,
    );
  });
});
