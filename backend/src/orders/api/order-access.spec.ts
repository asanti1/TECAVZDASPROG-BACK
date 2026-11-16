import { UserRole } from '../../shared/auth/role.js';
import { ForbiddenActionError } from '../../shared/errors.js';
import { OrderType } from '../domain/order-status.js';
import type { Order } from '../domain/order.js';
import type { CreateOrderDto } from './create-order.dto.js';
import { assertCanSeeOrder, customerIdFor, customerScope } from './order-access.js';

const admin = { id: 'a1', role: UserRole.ADMIN, branchId: 'b1' };
const customer = { id: 'c1', role: UserRole.CUSTOMER, branchId: null };

const customerDto = { type: OrderType.CUSTOMER, customerId: 'otro-cliente' } as CreateOrderDto;

describe('permisos sobre pedidos', () => {
  it('el cliente crea siempre a su nombre, aunque el cuerpo diga otro cliente', () => {
    expect(customerIdFor(customer, customerDto)).toBe('c1');
    expect(customerIdFor(admin, customerDto)).toBe('otro-cliente');
  });

  it('el cliente no puede crear pedidos entre sucursales', () => {
    const interBranch = { type: OrderType.INTER_BRANCH } as CreateOrderDto;
    expect(() => customerIdFor(customer, interBranch)).toThrow(
      ForbiddenActionError,
    );
    expect(customerIdFor(admin, interBranch)).toBeUndefined();
  });

  it('el cliente ve solo sus pedidos; el admin todos', () => {
    const mine = { customerId: 'c1' } as Order;
    const theirs = { customerId: 'c2' } as Order;
    
    expect(() => assertCanSeeOrder(customer, mine)).not.toThrow();
    expect(() => assertCanSeeOrder(customer, theirs)).toThrow(ForbiddenActionError);
    expect(() => assertCanSeeOrder(admin, theirs)).not.toThrow();
    expect(customerScope(customer)).toBe('c1');
    expect(customerScope(admin)).toBeUndefined();
  });
});
