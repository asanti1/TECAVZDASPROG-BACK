import { isUUID } from 'class-validator';
import { InvalidLocationError } from '../../shared/errors.js';
import type { Coordinates } from '../../shared/geo/coordinates.js';

export interface DriverLocation {
  tripId: string;
  position: Coordinates;
  recordedAt: Date;
}

export function parseLocationReport(raw: unknown): {
  tripId: string;
  position: Coordinates;
} {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const { tripId, latitude, longitude } = body;
  if (typeof tripId !== 'string' || !isUUID(tripId)) {
    throw new InvalidLocationError('tripId debe ser un UUID');
  }
  if (!isFiniteBetween(latitude, -90, 90)) {
    throw new InvalidLocationError('latitude debe estar entre -90 y 90');
  }
  if (!isFiniteBetween(longitude, -180, 180)) {
    throw new InvalidLocationError('longitude debe estar entre -180 y 180');
  }
  return { tripId, position: { latitude, longitude } };
}

function isFiniteBetween(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
