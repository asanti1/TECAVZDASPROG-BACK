import { TripNotFoundError } from '../../../shared/errors.js';
import type { TripsService } from '../../application/trips.service.js';
import type { RoutePlan } from '../../domain/route-plan.js';
import { RouteResultHandler } from './route-result-handler.js';

const message = (overrides: Record<string, unknown> = {}): Buffer =>
  Buffer.from(
    JSON.stringify({
      tripId: 't1',
      legs: [
        {
          sequenceOrder: 1,
          toOrderId: 'o1',
          geometry: [
            { latitude: -38.7, longitude: -62.3 },
            { latitude: -38.6, longitude: -62.2 },
          ],
          distanceKm: 3.2,
          estimatedTimeMin: 7,
          algorithmUsed: 'dijkstra',
        },
      ],
      ...overrides,
    }),
  );

const handlerWith = (attach: (plan: RoutePlan) => Promise<boolean>) =>
  new RouteResultHandler({ attachRoutePlan: attach } as TripsService);

describe('RouteResultHandler', () => {
  it('entrega el plan al viaje y confirma el mensaje', async () => {
    const received: RoutePlan[] = [];
    const handler = handlerWith(async (plan) => {
      received.push(plan);
      return true;
    });

    expect(await handler.handle(message(), false)).toBe('ack');

    expect(received[0]?.tripId).toBe('t1');
    expect(received[0]?.legs[0]?.toOrderId).toBe('o1');
    expect(received[0]?.legs[0]?.geometry).toHaveLength(2);
  });

  it('un resultado duplicado se confirma sin hacer nada más', async () => {
    const handler = handlerWith(async () => false);

    expect(await handler.handle(message(), false)).toBe('ack');
  });

  it.each([
    ['no es JSON', Buffer.from('basura')],
    ['le falta tripId', message({ tripId: undefined })],
    ['tiene un tramo inválido', message({ legs: [{ sequenceOrder: 0 }] })],
  ])('descarta un mensaje que %s', async (_, content) => {
    const handler = handlerWith(async () => true);

    expect(await handler.handle(content, false)).toBe('discard');
  });

  it('descarta el resultado de un viaje que no existe', async () => {
    const handler = handlerWith(() =>
      Promise.reject(new TripNotFoundError('no existe')),
    );

    expect(await handler.handle(message(), false)).toBe('discard');
  });

  it('reintenta una vez ante una falla transitoria y después descarta', async () => {
    const handler = handlerWith(() => Promise.reject(new Error('base caída')));

    expect(await handler.handle(message(), false)).toBe('retry');
    expect(await handler.handle(message(), true)).toBe('discard');
  });
});
