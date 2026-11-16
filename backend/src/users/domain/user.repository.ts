import type { User, UserRole } from './user.js';

export interface IUserRepository {
  findByRole(role: UserRole): Promise<User[]>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
