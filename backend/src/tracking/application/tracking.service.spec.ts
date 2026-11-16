import { UserRole } from '../../shared/auth/role.js';
import { ForbiddenActionError, InvalidLocationError, InvalidTripTransitionError, TripNotFoundError } from '../../shared/errors.js';
import type { TripsService } from '../../trips/application/trips.service.js';
import { TripStatus } from '../../trips/domain/trip-status.js';
import type { Trip } from '../../trips/domain/trip.js';
import type { DriverLocation } from '../domain/driver-location.js';
import { InMemoryLocationStore } from '../infrastructure/in-memory-location-store.js';
import { TrackingService } from './tracking.service.js';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-13T22:00:00Z');
const DRIVER_ID = 'd1111111-1111-4111-8111-111111111111';
const admin = { id: 'a', role: UserRole.ADMIN, branchId: null };
const driver = { id: DRIVER_ID, role: UserRole.DELIVERY_PERSON, branchId: 'b' };

function build(status: TripStatus | null) {
  const trips = {
    getTrip: (id: string) =>
      status === null
        ? Promise.reject(new TripNotFoundError(id))
        : Promise.resolve({ id, status, deliveryPersonId: DRIVER_ID } as Trip)
  } as unknown as TripsService;
  return new TrackingService(trips, new InMemoryLocationStore());
}

const report = { tripId: TRIP_ID, latitude: -38.7, longitude: -62.2 };

describe('TrackingService', () => {
  it('guarda la última posición y avisa a los suscriptos del viaje', async () => {
    const service = build(TripStatus.IN_PROGRESS);
    const received: DriverLocation[] = [];
    service.subscribe(TRIP_ID, (l) => received.push(l));

    await service.report(report, admin, NOW);

    expect(received).toEqual([
      {
        tripId: TRIP_ID,
        position: { latitude: -38.7, longitude: -62.2 },
        recordedAt: NOW,
      },
    ]);
    expect((await service.lastLocation(TRIP_ID, admin))?.recordedAt).toEqual(NOW);
  });

  it('no avisa a quien se dio de baja ni a suscriptos de otro viaje', async () => {
    const service = build(TripStatus.IN_PROGRESS);
    const calls: string[] = [];
    const off = service.subscribe(TRIP_ID, () => calls.push('baja'));
    service.subscribe('22222222-2222-4222-8222-222222222222', () => calls.push('otro'));

    off();
    await service.report(report, admin, NOW);
    expect(calls).toEqual([]);
  });

  it.each([TripStatus.PLANNED, TripStatus.COMPLETED])(
    'rechaza ubicaciones de un viaje %s',
    async (status) => {
      await expect(build(status).report(report, admin)).rejects.toBeInstanceOf(InvalidTripTransitionError);
    });

  it('rechaza un viaje inexistente', async () => {
    await expect(build(null).report(report, admin)).rejects.toBeInstanceOf(TripNotFoundError);
  });

  it.each([
    { ...report, tripId: 'no-es-uuid' },
    { ...report, latitude: 91 },
    { ...report, longitude: -181 },
    { ...report, latitude: '1' },
    { ...report, latitude: NaN },
    null,
  ])('rechaza datos inválidos %j', async (body) => {
    await expect(build(TripStatus.IN_PROGRESS).report(body, admin)).rejects.toBeInstanceOf(InvalidLocationError);
  });

  it('sin reportes previos la última posición es null', async () => {
    expect(await build(TripStatus.IN_PROGRESS).lastLocation(TRIP_ID, admin)).toBeNull();
  });

  it('el repartidor reporta solo en su viaje; otro repartidor y el cliente no', async () => {
    const service = build(TripStatus.IN_PROGRESS);
    await expect(service.report(report, driver, NOW)).resolves.toBeDefined();

    const other = { ...driver, id: 'd2222222-2222-4222-8222-222222222222' };
    const customer = { ...admin, role: UserRole.CUSTOMER };
    for (const user of [other, customer]) {
      await expect(service.report(report, user)).rejects.toBeInstanceOf(ForbiddenActionError);
      await expect(service.lastLocation(TRIP_ID, user)).rejects.toBeInstanceOf(ForbiddenActionError);
    }
  });
});
