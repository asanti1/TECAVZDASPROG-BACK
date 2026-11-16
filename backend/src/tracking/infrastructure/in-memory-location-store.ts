import { Injectable } from '@nestjs/common';
import type { DriverLocation } from '../domain/driver-location.js';
import type { ILocationStore } from '../domain/location-store.js';


@Injectable()
export class InMemoryLocationStore implements ILocationStore {
  private readonly lastByTrip = new Map<string, DriverLocation>();

  save(location: DriverLocation): void {
    this.lastByTrip.set(location.tripId, location);
  }

  findLast(tripId: string): DriverLocation | null {
    return this.lastByTrip.get(tripId) ?? null;
  }
}
