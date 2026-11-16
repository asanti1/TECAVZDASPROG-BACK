import type { OrderStatus } from './order-status.js';
import type { Order } from './order.js';

export interface OrderFilter {
  status?: OrderStatus;
  originBranchId?: string;
  customerId?: string;
}

export interface IOrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  findByIds(ids: ReadonlyArray<string>): Promise<Order[]>;
  findAll(filter: OrderFilter): Promise<Order[]>;
}

export const ORDER_REPOSITORY = Symbol('IOrderRepository');
