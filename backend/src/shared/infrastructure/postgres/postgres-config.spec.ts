import { loadPostgresConfig } from './postgres-config.js';

describe('loadPostgresConfig', () => {
  it('usa los mismos valores por defecto que el docker-compose', () => {
    expect(loadPostgresConfig({})).toEqual({
      host: 'localhost',
      port: 5432,
      database: 'logistics',
      user: 'logistics',
      password: 'logistics_dev',
    });
  });

  it('toma cada valor de su variable de entorno', () => {
    expect(
      loadPostgresConfig({
        POSTGRES_HOST: 'db',
        POSTGRES_PORT: '6543',
        POSTGRES_DB: 'otra',
        POSTGRES_USER: 'u',
        POSTGRES_PASSWORD: 'p',
      }),
    ).toEqual({
      host: 'db',
      port: 6543,
      database: 'otra',
      user: 'u',
      password: 'p',
    });
  });

  it.each(['abc', '70000'])('rechaza el puerto %j', (port) => {
    expect(() => loadPostgresConfig({ POSTGRES_PORT: port })).toThrow(
      'POSTGRES_PORT inválido',
    );
  });
});
