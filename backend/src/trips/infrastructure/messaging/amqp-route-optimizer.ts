import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import type { RecoveringChannelModel } from 'amqplib';
import amqplib from 'amqplib';
import { amqpUrl, loadRabbitMqConfig } from '../../../shared/infrastructure/rabbitmq/rabbitmq-config.js';
import type { IRouteOptimizer } from '../../domain/route-optimizer.js';
import type { RoutePlanRequest } from '../../domain/route-plan.js';
import { serializeRequest } from './route-messages.js';
import { ROUTE_REQUESTS_KEY, ROUTING_EXCHANGE } from './route-topology.js';

const PUBLISH_TIMEOUT_MS = 5000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`RabbitMQ no respondió en ${ms} ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}


@Injectable()
export class AmqpRouteOptimizer
  implements IRouteOptimizer, OnApplicationShutdown {
  private readonly logger = new Logger(AmqpRouteOptimizer.name);
  private connection: RecoveringChannelModel | null = null;

  requestRoutePlan(request: RoutePlanRequest): Promise<void> {
    return withTimeout(this.publish(request), PUBLISH_TIMEOUT_MS);
  }

  private async publish(request: RoutePlanRequest): Promise<void> {
    const channel = await (await this.connect()).createConfirmChannel();
    try {
      await new Promise<void>((resolve, reject) => {
        channel.publish(
          ROUTING_EXCHANGE,
          ROUTE_REQUESTS_KEY,
          serializeRequest(request),
          {
            persistent: true,
            contentType: 'application/json',
            messageId: request.tripId,
          },
          (error) => (error ? reject(error) : resolve()),
        );
      });
    } finally {
      await channel.close().catch(() => undefined);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection?.close().catch(() => undefined);
  }

  private async connect(): Promise<RecoveringChannelModel> {
    if (!this.connection) {
      const connection = await amqplib.connect(amqpUrl(loadRabbitMqConfig()), {
        recovery: {
          initialDelay: 500,
          maxDelay: 5000,
          maxRetries: Infinity,
          initialMaxRetries: 2,
        },
      });
      connection.on('error', (error) =>
        this.logger.error(`Conexión con RabbitMQ: ${error.message}`),
      );
      this.connection = connection;
    }
    return this.connection;
  }
}
