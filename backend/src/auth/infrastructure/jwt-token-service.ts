import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { UserRole } from '../../shared/auth/role.js';
import type { ITokenVerifier } from '../../shared/auth/token-verifier.js';
import type { ITokenIssuer } from '../domain/token-issuer.js';

interface Claims {
  sub: string;
  role: UserRole;
  branchId: string | null;
}

@Injectable()
export class JwtTokenService implements ITokenIssuer, ITokenVerifier {
  constructor(private readonly jwt: JwtService) {}

  issue(user: AuthenticatedUser): string {
    const claims: Claims = {
      sub: user.id,
      role: user.role,
      branchId: user.branchId,
    };
    return this.jwt.sign(claims);
  }

  verify(token: string): AuthenticatedUser | null {
    try {
      const claims = this.jwt.verify<Claims>(token);
      if (!Object.values(UserRole).includes(claims.role)) return null;

      return { id: claims.sub, role: claims.role, branchId: claims.branchId };
      
    } catch {
      return null;
    }
  }
}
