import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { UserRole } from '../../shared/auth/role.js';
import { ForbiddenActionError } from '../../shared/errors.js';
import { OrderType } from '../domain/order-status.js';
import type { Order } from '../domain/order.js';
import type { CreateOrderDto } from './create-order.dto.js';


export function customerIdFor(user: AuthenticatedUser, dto: CreateOrderDto): string | undefined {
  if (user.role !== UserRole.CUSTOMER) return dto.customerId;
  if (dto.type !== OrderType.CUSTOMER) {
    throw new ForbiddenActionError('Un cliente solo puede crear pedidos de cliente');
  }
  return user.id;
}

export function assertCanSeeOrder(user: AuthenticatedUser, order: Order): void {
  if (user.role === UserRole.ADMIN) return;
  if (user.role !== UserRole.CUSTOMER || order.customerId !== user.id) {
    throw new ForbiddenActionError('Ese pedido no es tuyo');
  }
}

export function customerScope(user: AuthenticatedUser): string | undefined {
  return user.role === UserRole.CUSTOMER ? user.id : undefined;
}
