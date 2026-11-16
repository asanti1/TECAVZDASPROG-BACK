import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { IS_PUBLIC } from '../../shared/auth/decorators.js';
import type { ITokenVerifier } from '../../shared/auth/token-verifier.js';
import { TOKEN_VERIFIER } from '../../shared/auth/token-verifier.js';
import { AuthenticationError } from '../../shared/errors.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Inject(TOKEN_VERIFIER) private readonly tokens: ITokenVerifier) { }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();

    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    const user = scheme === 'Bearer' && token ? this.tokens.verify(token) : null;

    if (!user) throw new AuthenticationError('Falta un token válido');
    
    request.user = user;
    return true;
  }
}
