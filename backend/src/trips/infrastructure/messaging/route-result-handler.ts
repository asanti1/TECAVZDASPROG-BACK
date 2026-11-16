import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../shared/errors.js';
import { TripsService } from '../../application/trips.service.js';
import { MalformedMessageError, parseRoutePlan } from './route-messages.js';


export type HandlingOutcome = 'ack' | 'discard' | 'retry';

@Injectable()
export class RouteResultHandler {
  private readonly logger = new Logger(RouteResultHandler.name);

  constructor(private readonly trips: TripsService) { }

  async handle(
    content: Buffer,
    redelivered: boolean,
  ): Promise<HandlingOutcome> {
    try {
      const plan = parseRoutePlan(content);
      const attached = await this.trips.attachRoutePlan(plan);
      if (!attached) {
        this.logger.warn(
          `Resultado repetido del viaje ${plan.tripId}: se ignora`,
        );
      }
      return 'ack';
    } catch (error) {
      return this.outcomeFor(error, redelivered);
    }
  }

  private outcomeFor(error: unknown, redelivered: boolean): HandlingOutcome {
    if (isPermanent(error)) {
      this.logger.error(`Resultado descartado: ${String(error)}`);
      return 'discard';
    }
    if (redelivered) {
      this.logger.error(`Falló dos veces, se descarta: ${String(error)}`);
      return 'discard';
    }
    this.logger.warn(`Falla transitoria, se reintenta: ${String(error)}`);
    return 'retry';
  }
}

function isPermanent(error: unknown): boolean {
  return error instanceof MalformedMessageError || error instanceof DomainError;
}
