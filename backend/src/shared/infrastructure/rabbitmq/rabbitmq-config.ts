export interface RabbitMqConfig {
  host: string;
  port: number;
  user: string;
  password: string;
}

export function loadRabbitMqConfig(env: NodeJS.ProcessEnv = process.env): RabbitMqConfig {
  const port = Number(env.RABBITMQ_PORT ?? '5672');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`RABBITMQ_PORT inválido: ${env.RABBITMQ_PORT}`);
  }
  return {
    host: env.RABBITMQ_HOST ?? 'localhost',
    port,
    user: env.RABBITMQ_BACKEND_USER ?? 'backend',
    password: env.RABBITMQ_BACKEND_PASSWORD ?? 'backend_dev',
  };
}

export function amqpUrl(config: RabbitMqConfig): string {
  const user = encodeURIComponent(config.user);
  const password = encodeURIComponent(config.password);
  return `amqp://${user}:${password}@${config.host}:${config.port}`;
}
