import { Injectable } from '@nestjs/common';
import { InsufficientStockError } from '../../shared/errors.js';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import type { RequestedItem } from '../domain/branch-selection.strategy.js';
import type { IStockRepository } from '../domain/stock.repository.js';

@Injectable()
export class PostgresStockRepository implements IStockRepository {
  constructor(private readonly session: PostgresSession) { }

  reserve(branchId: string, items: ReadonlyArray<RequestedItem>): Promise<void> {
    const itemsInLockOrder = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
    
    return this.session.runInTransaction(async () => {
      for (const { productId, quantity } of itemsInLockOrder) {
        const result = await this.session.query(
          `UPDATE branch_stock
              SET stock_qty = stock_qty - $3
            WHERE branch_id = $1 AND product_id = $2 AND stock_qty >= $3`,
          [branchId, productId, quantity],
        );

        if (result.rowCount === 0) {
          throw new InsufficientStockError(
            `Stock insuficiente del producto ${productId} en la sucursal ${branchId}`,
          );
        }
      }
    });
  }
}
