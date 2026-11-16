import type { AuthenticatedUser } from './authenticated-user.js';

export interface ITokenVerifier {
  verify(token: string): AuthenticatedUser | null;
}

export const TOKEN_VERIFIER = Symbol('ITokenVerifier');
