import type { UserRole } from './role.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  branchId: string | null;
}
