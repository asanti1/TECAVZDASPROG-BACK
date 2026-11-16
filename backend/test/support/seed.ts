import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export async function insertBranch(pool: Pool, location = { latitude: -34.6, longitude: -58.4 }, name = 'Sucursal'): Promise<string> {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO branches (id, name, latitude, longitude) VALUES ($1, $2, $3, $4)',
    [id, name, location.latitude, location.longitude],
  );
  return id;
}

export async function insertProduct(pool: Pool): Promise<string> {
  const id = randomUUID();
  await pool.query('INSERT INTO products (id, name, sku) VALUES ($1, $2, $3)', [
    id,
    'Producto',
    `sku-${id}`,
  ]);
  return id;
}

export async function setStock(pool: Pool, branchId: string, productId: string, quantity: number): Promise<void> {
  await pool.query(
    `INSERT INTO branch_stock (branch_id, product_id, stock_qty) VALUES ($1, $2, $3)
     ON CONFLICT (branch_id, product_id) DO UPDATE SET stock_qty = EXCLUDED.stock_qty`,
    [branchId, productId, quantity],
  );
}

export async function readStock(pool: Pool, branchId: string, productId: string): Promise<number> {
  const { rows } = await pool.query<{ stock_qty: number }>(
    'SELECT stock_qty FROM branch_stock WHERE branch_id = $1 AND product_id = $2',
    [branchId, productId],
  );
  return rows[0]!.stock_qty;
}

export async function insertUser(pool: Pool, role: 'CUSTOMER' | 'DELIVERY_PERSON' | 'ADMIN',
  branchId: string | null,
  login: { email: string; passwordHash: string } | null = null): Promise<string> {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO users (id, role, name, email, password_hash, branch_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, role, 'Usuario', login?.email ?? `${id}@test.local`, login?.passwordHash ?? 'hash', branchId],
  );
  return id;
}

export async function insertTrip(pool: Pool, deliveryPersonId: string, originBranchId: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    'INSERT INTO trips (id, delivery_person_id, origin_branch_id) VALUES ($1, $2, $3)',
    [id, deliveryPersonId, originBranchId],
  );
  return id;
}
