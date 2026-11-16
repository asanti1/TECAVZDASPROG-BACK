import { UserRole } from '../../shared/auth/role.js';
import type { Trip } from '../domain/trip.js';
import { canAccessTrip } from './trip-access.js';

const trip = { deliveryPersonId: 'd1' } as Trip;
const as = (role: UserRole, id: string) => ({ id, role, branchId: null });

describe('canAccessTrip', () => {
  it.each([
    ['admin', UserRole.ADMIN, 'x', true],
    ['su repartidor', UserRole.DELIVERY_PERSON, 'd1', true],
    ['otro repartidor', UserRole.DELIVERY_PERSON, 'd2', false],
    ['un cliente', UserRole.CUSTOMER, 'd1', false],
  ])('%s', (_quien, role, id, expected) => {
    expect(canAccessTrip(as(role, id), trip)).toBe(expected);
  });
});
