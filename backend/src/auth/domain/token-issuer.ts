import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';

export interface ITokenIssuer {
  issue(user: AuthenticatedUser): string;
}

export const TOKEN_ISSUER = Symbol('ITokenIssuer');
