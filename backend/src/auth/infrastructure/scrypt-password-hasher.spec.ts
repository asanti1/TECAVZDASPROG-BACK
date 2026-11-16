import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('verifica la clave correcta, rechaza otra, y usa sal distinta cada vez', async () => {
    const first = await hasher.hash('demo1234');
    const second = await hasher.hash('demo1234');

    expect(first).not.toBe(second);
    expect(await hasher.verify('demo1234', first)).toBe(true);
    expect(await hasher.verify('demo12345', first)).toBe(false);
  });

  it('un valor guardado con otro formato no autentica a nadie', async () => {
    expect(await hasher.verify('sin-login', 'sin-login')).toBe(false);
  });
});
