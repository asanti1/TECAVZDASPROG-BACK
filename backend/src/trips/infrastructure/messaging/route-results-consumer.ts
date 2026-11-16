import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { ChannelModel, RecoveringChannelModel } from 'amqplib';
import amqplib from 'amqplib';
import { amqpUrl, loadRabbitMqConfig } from '../../../shared/infrastructure/rabbitmq/rabbitmq-config.js';
import { RouteResultHandler } from './route-result-handler.js';
import { ROUTE_RESULTS_QUEUE } from './route-topology.js';

const PREFETCH = 10;

@Injectable()
export class RouteResultsConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RouteResultsConsumer.name);
  private connection: RecoveringChannelModel | null = null;

  constructor(private readonly handler: RouteResultHandler) { }

  async onApplicationBootstrap(): Promise<void> {
    this.connection = await amqplib.connect(amqpUrl(loadRabbitMqConfig()), {
      recovery: {
        waitForConnect: false,
        initialDelay: 500,
        maxDelay: 5000,
        maxRetries: Infinity,
        setup: (model: ChannelModel) => this.startConsuming(model),
      },
    });
    this.connection.on('connect-failed', (error) =>
      this.logger.warn(`RabbitMQ no disponible: ${error.message}`),
    );
    this.connection.on('error', (error) =>
      this.logger.error(`Conexión con RabbitMQ: ${error.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection?.close().catch(() => undefined);
  }

  private async startConsuming(model: ChannelModel): Promise<void> {
    const channel = await model.createChannel();
    await channel.prefetch(PREFETCH);
    await channel.consume(ROUTE_RESULTS_QUEUE, (message) => {
      if (!message) {
        return;
      }
      void this.handler.handle(message.content, message.fields.redelivered).then((outcome) => {
        if (outcome === 'ack') {
          channel.ack(message);
        } else {
          channel.nack(message, false, outcome === 'retry');
        }
      })
        .catch((error: unknown) => {
          this.logger.error(`Error inesperado: ${String(error)}`);
          channel.nack(message, false, false);
        });
    });
    this.logger.log(`Escuchando resultados en ${ROUTE_RESULTS_QUEUE}`);
  }
}
