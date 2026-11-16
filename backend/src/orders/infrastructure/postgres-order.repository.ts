import { Injectable } from '@nestjs/common';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import type { OrderStatus, OrderType } from '../domain/order-status.js';
import type { DeliveryAddress } from '../domain/order.js';
import { Order } from '../domain/order.js';
import type { IOrderRepository, OrderFilter } from '../domain/order.repository.js';

interface OrderRow {
  id: string;
  type: OrderType;
  status: OrderStatus;
  origin_branch_id: string;
  destination_branch_id: string | null;
  customer_id: string | null;
  delivery_address: DeliveryAddress | null;
  trip_id: string | null;
  created_at: Date;
}

interface OrderItemRow {
  order_id: string;
  product_id: string;
  quantity: number;
}

const ORDER_COLUMNS = `id, type, status, origin_branch_id, destination_branch_id,
  customer_id, delivery_address, trip_id, created_at`;

@Injectable()
export class PostgresOrderRepository implements IOrderRepository {
  constructor(private readonly session: PostgresSession) { }

  save(order: Order): Promise<void> {
    return this.session.runInTransaction(async () => {
      await this.session.query(
        `INSERT INTO orders (
           id, type, status, origin_branch_id, destination_branch_id,
           customer_id, delivery_address, trip_id, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
         ON CONFLICT (id) DO UPDATE
           SET status = EXCLUDED.status, trip_id = EXCLUDED.trip_id`,
        [
          order.id,
          order.type,
          order.status,
          order.originBranchId,
          order.destinationBranchId,
          order.customerId,
          order.deliveryAddress ? JSON.stringify(order.deliveryAddress) : null,
          order.tripId,
          order.createdAt,
        ],
      );
      await this.session.query(
        `INSERT INTO order_items (order_id, product_id, quantity)
         SELECT $1, product_id, quantity
           FROM unnest($2::uuid[], $3::int[]) AS item(product_id, quantity)
         ON CONFLICT (order_id, product_id) DO NOTHING`,
        [
          order.id,
          order.items.map((item) => item.productId),
          order.items.map((item) => item.quantity),
        ],
      );
    });
  }

  async findById(id: string): Promise<Order | null> {
    const [order] = await this.findByIds([id]);
    return order ?? null;
  }

  async findByIds(ids: ReadonlyArray<string>): Promise<Order[]> {
    const { rows } = await this.session.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders
        WHERE id = ANY($1::uuid[]) ORDER BY created_at, id`,
      [ids],
    );
    return this.hydrate(rows);
  }

  async findAll(filter: OrderFilter): Promise<Order[]> {
    const { rows } = await this.session.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders
        WHERE ($1::text IS NULL OR status = $1)
          AND ($2::uuid IS NULL OR origin_branch_id = $2)
          AND ($3::uuid IS NULL OR customer_id = $3)
        ORDER BY created_at DESC, id`,
      [
        filter.status ?? null,
        filter.originBranchId ?? null,
        filter.customerId ?? null,
      ],
    );
    return this.hydrate(rows);
  }

  private async hydrate(rows: OrderRow[]): Promise<Order[]> {
    if (rows.length === 0) {
      return [];
    }
    const { rows: itemRows } = await this.session.query<OrderItemRow>(
      `SELECT order_id, product_id, quantity FROM order_items
        WHERE order_id = ANY($1::uuid[]) ORDER BY product_id`,
      [rows.map((row) => row.id)],
    );
    const itemsByOrder = new Map<string, OrderItemRow[]>();
    for (const item of itemRows) {
      itemsByOrder.set(item.order_id, [
        ...(itemsByOrder.get(item.order_id) ?? []),
        item,
      ]);
    }
    return rows.map(
      (row) =>
        new Order({
          id: row.id,
          type: row.type,
          status: row.status,
          originBranchId: row.origin_branch_id,
          destinationBranchId: row.destination_branch_id,
          customerId: row.customer_id,
          deliveryAddress: row.delivery_address,
          tripId: row.trip_id,
          createdAt: row.created_at,
          items: (itemsByOrder.get(row.id) ?? []).map((item) => ({
            productId: item.product_id,
            quantity: item.quantity,
          })),
        }),
    );
  }
}
