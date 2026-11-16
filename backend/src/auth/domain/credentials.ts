import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';

export interface Credentials {
  user: AuthenticatedUser;
  name: string;
  passwordHash: string;
}

export interface ICredentialsRepository {
  findByEmail(email: string): Promise<Credentials | null>;
}

export const CREDENTIALS_REPOSITORY = Symbol('ICredentialsRepository');
