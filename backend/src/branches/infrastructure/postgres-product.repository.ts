import { Injectable } from '@nestjs/common';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import type { IProductRepository, ProductWithStock } from '../domain/product.repository.js';

interface ProductStockRow {
  id: string;
  name: string;
  sku: string;
  branch_id: string | null;
  stock_qty: number | null;
}

@Injectable()
export class PostgresProductRepository implements IProductRepository {
  constructor(private readonly session: PostgresSession) { }

  async findAllWithStock(): Promise<ProductWithStock[]> {
    const { rows } = await this.session.query<ProductStockRow>(
      `SELECT p.id, p.name, p.sku, s.branch_id, s.stock_qty
         FROM products p
         LEFT JOIN branch_stock s ON s.product_id = p.id
        ORDER BY p.name, p.id, s.branch_id`,
    );

    const products = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        stock: ProductWithStock['stock'];
      }
    >();
    for (const row of rows) {
      const product = products.get(row.id) ?? {
        id: row.id,
        name: row.name,
        sku: row.sku,
        stock: [],
      };
      if (row.branch_id !== null && row.stock_qty !== null) {
        product.stock = [
          ...product.stock,
          { branchId: row.branch_id, quantity: row.stock_qty },
        ];
      }
      products.set(row.id, product);
    }
    return [...products.values()];
  }
}
