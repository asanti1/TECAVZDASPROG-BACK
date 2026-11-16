import { Injectable } from '@nestjs/common';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import type { User, UserRole } from '../domain/user.js';
import type { IUserRepository } from '../domain/user.repository.js';

interface UserRow {
  id: string;
  name: string;
  role: UserRole;
  branch_id: string | null;
}

@Injectable()
export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly session: PostgresSession) {}

  async findByRole(role: UserRole): Promise<User[]> {
    const { rows } = await this.session.query<UserRow>(
      'SELECT id, name, role, branch_id FROM users WHERE role = $1 ORDER BY name, id',
      [role],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      branchId: row.branch_id,
    }));
  }
}
