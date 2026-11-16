import type { DriverLocation } from '../domain/driver-location.js';

export function presentLocation(location: DriverLocation) {
  return {
    tripId: location.tripId,
    latitude: location.position.latitude,
    longitude: location.position.longitude,
    recordedAt: location.recordedAt.toISOString(),
  };
}
