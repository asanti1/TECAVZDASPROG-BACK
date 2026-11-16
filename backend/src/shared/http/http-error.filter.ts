import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  AuthenticationError, BranchNotFoundError, DomainError,
  ForbiddenActionError, InsufficientStockError, InvalidLocationError,
  InvalidOrderError, InvalidOrderTransitionError, InvalidRouteError,
  InvalidRoutePlanError, InvalidTripError, InvalidTripTransitionError,
  NoBranchAvailableError, NoDeliveryPersonAvailableError, OrderNotFoundError, TripNotFoundError,
} from '../errors.js';

const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

type DomainErrorClass = abstract new (message: string) => DomainError;

const STATUS_BY_DOMAIN_ERROR: ReadonlyArray<[DomainErrorClass, HttpStatus]> = [
  [AuthenticationError, HttpStatus.UNAUTHORIZED],
  [ForbiddenActionError, HttpStatus.FORBIDDEN],
  [InvalidOrderError, HttpStatus.BAD_REQUEST],
  [InvalidTripError, HttpStatus.BAD_REQUEST],
  [InvalidRouteError, HttpStatus.BAD_REQUEST],
  [InvalidLocationError, HttpStatus.BAD_REQUEST],
  [OrderNotFoundError, HttpStatus.NOT_FOUND],
  [TripNotFoundError, HttpStatus.NOT_FOUND],
  [BranchNotFoundError, HttpStatus.NOT_FOUND],
  [InvalidOrderTransitionError, HttpStatus.CONFLICT],
  [InvalidTripTransitionError, HttpStatus.CONFLICT],
  [NoBranchAvailableError, HttpStatus.CONFLICT],
  [NoDeliveryPersonAvailableError, HttpStatus.CONFLICT],
  [InsufficientStockError, HttpStatus.CONFLICT],
  [InvalidRoutePlanError, HttpStatus.UNPROCESSABLE_ENTITY],
];

function hasPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

export function statusFor(error: unknown): HttpStatus {
  if (error instanceof HttpException) {
    return error.getStatus();
  }
  if (error instanceof DomainError) {
    const match = STATUS_BY_DOMAIN_ERROR.find(
      ([errorClass]) => error instanceof errorClass,
    );
    return match ? match[1] : HttpStatus.INTERNAL_SERVER_ERROR;
  }
  if (hasPgCode(error, FOREIGN_KEY_VIOLATION)) {
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
  if (hasPgCode(error, UNIQUE_VIOLATION)) {
    return HttpStatus.CONFLICT;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = statusFor(error);

    if (error instanceof HttpException) {
      response.status(status).json(error.getResponse());
      return;
    }
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
      response.status(status).json({ statusCode: status, message: 'Error interno del servidor' });
      return;
    }
    const message = error instanceof DomainError ? error.message : 'La referencia a un recurso inexistente';
    response.status(status).json({
      statusCode: status,
      error: error instanceof Error ? error.name : 'Error',
      message,
    });
  }
}
