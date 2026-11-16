import type { UserRole } from '../../shared/auth/role.js';

export { UserRole } from '../../shared/auth/role.js';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  branchId: string | null;
}
