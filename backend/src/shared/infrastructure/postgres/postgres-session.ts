import { Inject, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PG_POOL } from './pg-pool.js';

@Injectable()
export class PostgresSession {
  private readonly currentTransaction = new AsyncLocalStorage<PoolClient>();

  constructor(@Inject(PG_POOL) private readonly pool: Pool) { }

  query<Row extends QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<Row>> {
    
    const executor = this.currentTransaction.getStore() ?? this.pool;
    return executor.query<Row>(text, values);
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.currentTransaction.getStore()) {
      return work();
    }
    const client = await this.pool.connect();
    let discardClient = false;
    try {
      await client.query('BEGIN');
      const result = await this.currentTransaction.run(client, work);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      discardClient = !(await this.tryRollback(client));
      throw error;
    } finally {
      client.release(discardClient);
    }
  }

  private async tryRollback(client: PoolClient): Promise<boolean> {
    try {
      await client.query('ROLLBACK');
      return true;
    } catch {
      return false;
    }
  }
}
