import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { UserRole } from '../../shared/auth/role.js';
import { ForbiddenActionError } from '../../shared/errors.js';
import type { Trip } from '../domain/trip.js';

export function canAccessTrip(user: AuthenticatedUser, trip: Trip): boolean {
  if (user.role === UserRole.ADMIN) return true;
  return user.role === UserRole.DELIVERY_PERSON && trip.deliveryPersonId === user.id;
}

export function assertCanAccessTrip(user: AuthenticatedUser, trip: Trip): void {
  if (!canAccessTrip(user, trip)) {
    throw new ForbiddenActionError('Ese viaje no es tuyo');
  }
}
