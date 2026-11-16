import { Injectable } from '@nestjs/common';
import type { IUnitOfWork } from '../../unit-of-work.js';
import { PostgresSession } from './postgres-session.js';

@Injectable()
export class PostgresUnitOfWork implements IUnitOfWork {
  constructor(private readonly session: PostgresSession) {}

  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.session.runInTransaction(work);
  }
}
