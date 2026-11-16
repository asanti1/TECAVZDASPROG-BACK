import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { ROLES } from '../../shared/auth/decorators.js';
import type { UserRole } from '../../shared/auth/role.js';
import { ForbiddenActionError } from '../../shared/errors.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [context.getHandler(), context.getClass()]);
    if (!allowed) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (!user || !allowed.includes(user.role)) {
      throw new ForbiddenActionError('Tu rol no puede hacer esta operación');
    }
    return true;
  }
}
