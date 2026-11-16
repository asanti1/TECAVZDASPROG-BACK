import { UserRole } from '../../shared/auth/role.js';
import { AuthenticationError } from '../../shared/errors.js';
import type { Credentials } from '../domain/credentials.js';
import { ScryptPasswordHasher } from '../infrastructure/scrypt-password-hasher.js';
import { AuthService } from './auth.service.js';

const hasher = new ScryptPasswordHasher();
const user = { id: 'u1', role: UserRole.ADMIN, branchId: 'b1' };

async function build() {
  const stored: Credentials = {
    user,
    name: 'Admin',
    passwordHash: await hasher.hash('clave-correcta'),
  };
  const lookups: string[] = [];
  const service = new AuthService(
    {
      findByEmail: async (email) => {
        lookups.push(email);
        return email === 'admin@demo.local' ? stored : null;
      },
    },
    hasher,
    { issue: (u) => `token-de-${u.id}` },
  );
  return { service, lookups };
}

describe('AuthService.login', () => {
  it('con credenciales correctas devuelve el token y el usuario, sin la clave', async () => {
    const { service, lookups } = await build();

    const result = await service.login(' Admin@Demo.local ', 'clave-correcta');

    expect(result).toEqual({
      accessToken: 'token-de-u1',
      user: { ...user, name: 'Admin' },
    });
    expect(lookups).toEqual(['admin@demo.local']);
  });

  it.each([
    ['clave incorrecta', 'admin@demo.local', 'otra'],
    ['mail inexistente', 'nadie@demo.local', 'clave-correcta'],
  ])('rechaza con el mismo error: %s', async (_caso, email, password) => {
    const { service } = await build();

    await expect(service.login(email, password)).rejects.toThrow(
      new AuthenticationError('Email o contraseña incorrectos'),
    );
  });
});
