import { Injectable } from '@nestjs/common';
import type { UserRole } from '../../shared/auth/role.js';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import type { Credentials, ICredentialsRepository } from '../domain/credentials.js';

interface CredentialsRow {
  id: string;
  name: string;
  role: UserRole;
  branch_id: string | null;
  password_hash: string;
}

@Injectable()
export class PostgresCredentialsRepository implements ICredentialsRepository {
  constructor(private readonly session: PostgresSession) { }

  async findByEmail(email: string): Promise<Credentials | null> {
    const { rows } = await this.session.query<CredentialsRow>(
      'SELECT id, name, role, branch_id, password_hash FROM users WHERE lower(email) = $1',
      [email],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      user: { id: row.id, role: row.role, branchId: row.branch_id },
      name: row.name,
      passwordHash: row.password_hash,
    };
  }
}
