import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { InvalidTripTransitionError } from '../../shared/errors.js';
import { assertCanAccessTrip } from '../../trips/application/trip-access.js';
import { TripsService } from '../../trips/application/trips.service.js';
import { TripStatus } from '../../trips/domain/trip-status.js';
import type { DriverLocation } from '../domain/driver-location.js';
import { parseLocationReport } from '../domain/driver-location.js';
import type { ILocationStore } from '../domain/location-store.js';
import { LOCATION_STORE } from '../domain/location-store.js';

export type LocationListener = (location: DriverLocation) => void;


@Injectable()
export class TrackingService {
  private readonly listeners = new Map<string, Set<LocationListener>>();

  constructor(private readonly trips: TripsService, @Inject(LOCATION_STORE) private readonly store: ILocationStore) { }

  async report(raw: unknown, user: AuthenticatedUser, now: Date = new Date()): Promise<DriverLocation> {
    const { tripId, position } = parseLocationReport(raw);
    const trip = await this.trips.getTrip(tripId);
    assertCanAccessTrip(user, trip);

    if (trip.status !== TripStatus.IN_PROGRESS) {
      throw new InvalidTripTransitionError(`Solo se reporta ubicación de viajes en curso; el viaje está '${trip.status}'`);
    }

    const location: DriverLocation = { tripId, position, recordedAt: now };
    this.store.save(location);
    this.listeners.get(tripId)?.forEach((listener) => listener(location));
    return location;
  }

  async lastLocation(
    tripId: string,
    user: AuthenticatedUser,
  ): Promise<DriverLocation | null> {
    assertCanAccessTrip(user, await this.trips.getTrip(tripId));
    return this.store.findLast(tripId);
  }

  subscribe(tripId: string, listener: LocationListener): () => void {
    const set = this.listeners.get(tripId) ?? new Set<LocationListener>();
    set.add(listener);
    this.listeners.set(tripId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(tripId);
    };
  }
}
