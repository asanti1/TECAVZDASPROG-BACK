import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { AuthenticationError } from '../../shared/errors.js';
import type { ICredentialsRepository } from '../domain/credentials.js';
import { CREDENTIALS_REPOSITORY } from '../domain/credentials.js';
import type { IPasswordHasher } from '../domain/password-hasher.js';
import { PASSWORD_HASHER } from '../domain/password-hasher.js';
import type { ITokenIssuer } from '../domain/token-issuer.js';
import { TOKEN_ISSUER } from '../domain/token-issuer.js';

export interface LoginResult {
  accessToken: string;
  user: AuthenticatedUser & { name: string };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(CREDENTIALS_REPOSITORY)
    private readonly credentials: ICredentialsRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: ITokenIssuer,
  ) { }

  async login(email: string, password: string): Promise<LoginResult> {
    const found = await this.credentials.findByEmail(
      email.trim().toLowerCase(),
    );
    if (!found || !(await this.hasher.verify(password, found.passwordHash))) {
      throw new AuthenticationError('Email o contraseña incorrectos');
    }
    return {
      accessToken: this.tokens.issue(found.user),
      user: { ...found.user, name: found.name },
    };
  }
}
