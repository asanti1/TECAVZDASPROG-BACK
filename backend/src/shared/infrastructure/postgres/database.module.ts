import { Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { UNIT_OF_WORK } from '../../unit-of-work.js';
import { PG_POOL } from './pg-pool.js';
import { loadPostgresConfig } from './postgres-config.js';
import { PostgresSession } from './postgres-session.js';
import { PostgresUnitOfWork } from './postgres-unit-of-work.js';

@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const pool = new Pool(loadPostgresConfig());
        const logger = new Logger('PostgresPool');
        pool.on('error', (error) => logger.error(`Error en una conexión inactiva: ${error.message}`));
        return pool;
      },
    },
    PostgresSession,
    { provide: UNIT_OF_WORK, useClass: PostgresUnitOfWork },
  ],
  exports: [PostgresSession, UNIT_OF_WORK],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) { }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
