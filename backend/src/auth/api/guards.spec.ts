import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../shared/auth/role.js';
import { AuthenticationError, ForbiddenActionError } from '../../shared/errors.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

const driver = { id: 'u1', role: UserRole.DELIVERY_PERSON, branchId: 'b1' };

function context(
  request: object,
  meta: { isPublic?: boolean; roles?: UserRole[] } = {}): ExecutionContext {
  const handler = () => undefined;
  Reflect.defineMetadata('isPublic', meta.isPublic, handler);
  Reflect.defineMetadata('roles', meta.roles, handler);
  return {
    getHandler: () => handler,
    getClass: () => class { },
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard(new Reflector(), {
    verify: (token) => (token === 'bueno' ? driver : null),
  });

  it('con Bearer valido deja pasar y guarda usurio en la request', () => {
    const request: { headers: object; user?: unknown } = {
      headers: { authorization: 'Bearer bueno' },
    };
    expect(guard.canActivate(context(request))).toBe(true);
    expect(request.user).toEqual(driver);
  });

  it.each([{}, { authorization: 'Bearer malo' }, { authorization: 'bueno' }])(
    'sin token válido (%j) responde no autenticado',
    (headers) => {
      expect(() => guard.canActivate(context({ headers }))).toThrow(AuthenticationError);
    },
  );

  it('las rutas públicas no piden token', () => {
    expect(guard.canActivate(context({ headers: {} }, { isPublic: true }))).toBe(true);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('sin @Roles deja pasar; con @Roles exige uno de los roles', () => {
    const request = { user: driver };
    expect(guard.canActivate(context(request))).toBe(true);
    expect(guard.canActivate(context(request, { roles: [UserRole.ADMIN, UserRole.DELIVERY_PERSON] }))).toBe(true);
    expect(() => guard.canActivate(context(request, { roles: [UserRole.ADMIN] }))).toThrow(ForbiddenActionError);
  });
});
