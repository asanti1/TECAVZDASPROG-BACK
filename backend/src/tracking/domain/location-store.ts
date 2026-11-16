import type { DriverLocation } from './driver-location.js';

export interface ILocationStore {
  save(location: DriverLocation): void;
  findLast(tripId: string): DriverLocation | null;
}

export const LOCATION_STORE = Symbol('ILocationStore');
