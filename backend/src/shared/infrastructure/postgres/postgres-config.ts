export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function loadPostgresConfig(env: NodeJS.ProcessEnv = process.env): PostgresConfig {
  const port = Number(env.POSTGRES_PORT ?? '5432');
  
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`POSTGRES_PORT inválido: ${env.POSTGRES_PORT}`);
  }
  return {
    host: env.POSTGRES_HOST ?? 'localhost',
    port,
    database: env.POSTGRES_DB ?? 'logistics',
    user: env.POSTGRES_USER ?? 'logistics',
    password: env.POSTGRES_PASSWORD ?? 'logistics_dev',
  };
}
