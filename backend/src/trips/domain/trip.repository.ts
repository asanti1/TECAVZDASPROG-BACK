import type { Trip } from './trip.js';

export interface ITripRepository {
  save(trip: Trip): Promise<void>;
  findById(id: string): Promise<Trip | null>;
  findAll(): Promise<Trip[]>;
}

export const TRIP_REPOSITORY = Symbol('ITripRepository');
