import { Injectable } from '@nestjs/common';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import type { BranchCandidate } from '../domain/branch-selection.strategy.js';
import type { Branch } from '../domain/branch.js';
import type { IBranchRepository } from '../domain/branch.repository.js';

interface BranchRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface CandidateRow extends BranchRow {
  product_id: string | null;
  stock_qty: number | null;
}

const toBranch = (row: BranchRow): Branch => ({
  id: row.id,
  name: row.name,
  location: { latitude: row.latitude, longitude: row.longitude },
});

@Injectable()
export class PostgresBranchRepository implements IBranchRepository {
  constructor(private readonly session: PostgresSession) { }

  async findById(id: string): Promise<Branch | null> {
    const { rows } = await this.session.query<BranchRow>(
      'SELECT id, name, latitude, longitude FROM branches WHERE id = $1',
      [id],
    );
    return rows[0] ? toBranch(rows[0]) : null;
  }

  async findAll(): Promise<Branch[]> {
    const { rows } = await this.session.query<BranchRow>(
      'SELECT id, name, latitude, longitude FROM branches ORDER BY name, id',
    );
    return rows.map(toBranch);
  }

  async findCandidatesWithStock(
    productIds: ReadonlyArray<string>,
  ): Promise<BranchCandidate[]> {
    const { rows } = await this.session.query<CandidateRow>(
      `SELECT b.id, b.name, b.latitude, b.longitude, s.product_id, s.stock_qty
         FROM branches b
         LEFT JOIN branch_stock s
           ON s.branch_id = b.id AND s.product_id = ANY($1::uuid[])
        ORDER BY b.id`,
      [productIds],
    );

    const candidates = new Map<string, BranchCandidate>();
    for (const row of rows) {
      const candidate = candidates.get(row.id) ?? {
        branch: toBranch(row),
        stock: new Map<string, number>(),
      };
      if (row.product_id !== null && row.stock_qty !== null) {
        (candidate.stock as Map<string, number>).set(
          row.product_id,
          row.stock_qty,
        );
      }
      candidates.set(row.id, candidate);
    }
    return [...candidates.values()];
  }
}
