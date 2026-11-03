import { InvalidRouteError } from '../../shared/errors.js';
import { Route, type RouteProps } from './route.js';

const geometry = [{ latitude: -34.6, longitude: -58.4 }, { latitude: -34.7, longitude: -58.5 }];

const props = (overrides: Partial<RouteProps> = {}): RouteProps => ({
  sequenceOrder: 1, toOrderId: 'o1', geometry, distanceKm: 12.5, estimatedTimeMin: 20, algorithmUsed: 'dijkstra', ...overrides,
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

  it.each([0, -1, 1.5, Number.NaN])('rechaza sequenceOrder %s', (sequenceOrder) => {
    expect(() => new Route(props({ sequenceOrder }))).toThrow(InvalidRouteError)
  });

  it('rechaza destino vacío', () => {
    expect(() => new Route(props({ toOrderId: '  ' }))).toThrow(InvalidRouteError);
  });

  it('rechaza geometría con menos de 2 puntos', () => {
    expect(() => new Route(props({ geometry: [] }))).toThrow(InvalidRouteError);

    expect(() => new Route(props({ geometry: [geometry[0]!] }))).toThrow(InvalidRouteError);
  });

  it('rechaza geometría con coordenadas no finitas', () => {
    const bad = [geometry[0]!, { latitude: Number.NaN, longitude: 0 }];
    expect(() => new Route(props({ geometry: bad }))).toThrow(InvalidRouteError);

    const inf = [geometry[0]!, { latitude: 0, longitude: Number.POSITIVE_INFINITY }];
    expect(() => new Route(props({ geometry: inf }))).toThrow(InvalidRouteError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rechaza distancia %s', (distanceKm) => {
    expect(() => new Route(props({ distanceKm }))).toThrow(InvalidRouteError);
  });

  it.each([-1, 1.5, Number.NaN])(
    'rechaza tiempo estimado %s', (estimatedTimeMin) => {
      expect(() => new Route(props({ estimatedTimeMin }))).toThrow(InvalidRouteError);
    });

  it('rechaza algoritmo vacío', () => {
    expect(() => new Route(props({ algorithmUsed: '' }))).toThrow(InvalidRouteError);
  });

  it('copia la geometría: mutar el original no afecta al tramo', () => {
    const original = [{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }];
    const route = new Route(props({ geometry: original }));

    original[0]!.latitude = 99;
    original.push({ latitude: 5, longitude: 6 });
    expect(route.geometry).toEqual([{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }]);
  });
});
