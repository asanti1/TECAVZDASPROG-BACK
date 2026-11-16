import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../shared/auth/role.js';
import { JwtTokenService } from './jwt-token-service.js';

const user = { id: 'u1', role: UserRole.DELIVERY_PERSON, branchId: 'b1' };
const service = (secret: string, expiresIn = 60) =>
  new JwtTokenService(new JwtService({ secret, signOptions: { expiresIn } }));

describe('JwtTokenService', () => {
  it('el token emitido se verifica y devuelve el mismo usuario', () => {
    const jwt = service('secreto');
    expect(jwt.verify(jwt.issue(user))).toEqual(user);
  });

  it('rechaza un token firmado con otra clave, vencido o basura', () => {
    const jwt = service('secreto');
    expect(jwt.verify(service('otra').issue(user))).toBeNull();
    expect(jwt.verify(service('secreto', -10).issue(user))).toBeNull();
    expect(jwt.verify('no-es-un-token')).toBeNull();
  });
});
