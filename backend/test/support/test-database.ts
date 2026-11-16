import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { loadPostgresConfig } from '../../src/shared/infrastructure/postgres/postgres-config.js';
import { PostgresSession } from '../../src/shared/infrastructure/postgres/postgres-session.js';

const initSql = readFileSync(new URL('../../../db/init.sql', import.meta.url), 'utf8');

const TABLES_IN_DELETION_ORDER = ['routes', 'order_items', 'orders', 'trips', 'branch_stock', 'products', 'vehicles', 'users', 'branches'];

export interface TestDatabase {
  databaseName: string;
  pool: Pool;
  session: PostgresSession;
  clearAllTables(): Promise<void>;
  drop(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const config = loadPostgresConfig();
  const name = `logistics_test_${randomUUID().replaceAll('-', '')}`;

  const admin = new Pool({ ...config, database: 'postgres' });
  await admin.query(`CREATE DATABASE ${name}`);

  const pool = new Pool({ ...config, database: name });
  pool.on('error', () => undefined);
  await pool.query(initSql);

  return {
    databaseName: name,
    pool,
    session: new PostgresSession(pool),
    async clearAllTables() {
      await pool.query(`TRUNCATE ${TABLES_IN_DELETION_ORDER.join(', ')}`);
    },
    async drop() {
      await pool.end();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
