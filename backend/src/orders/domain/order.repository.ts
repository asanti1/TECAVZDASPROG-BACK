import type { Order } from './order.js';

export interface IOrderRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

export const ORDER_REPOSITORY = Symbol('IOrderRepository');
