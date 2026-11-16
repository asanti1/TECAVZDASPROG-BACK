import { BadRequestException, HttpStatus } from '@nestjs/common';
import {
  AuthenticationError, DomainError, ForbiddenActionError, InsufficientStockError,
  InvalidOrderError, InvalidRoutePlanError, NoDeliveryPersonAvailableError, TripNotFoundError
} from '../errors.js';
import { statusFor } from './http-error.filter.js';

describe('statusFor', () => {
  it.each([
    [new InvalidOrderError('x'), 400],
    [new AuthenticationError('x'), 401],
    [new ForbiddenActionError('x'), 403],
    [new TripNotFoundError('x'), 404],
    [new InsufficientStockError('x'), 409],
    [new NoDeliveryPersonAvailableError('x'), 409],
    [new InvalidRoutePlanError('x'), 422],
  ])('%o -> %i', (error, status) => {
    expect(statusFor(error)).toBe(status);
  });

  it('respeta el código de una HttpException', () => {
    expect(statusFor(new BadRequestException('mal'))).toBe(
      HttpStatus.BAD_REQUEST,
    );
  });

  it('una violación de clave foránea de Postgres es 422', () => {
    expect(statusFor({ code: '23503' })).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(statusFor({ code: '23505' })).toBe(HttpStatus.CONFLICT);
  });

  it('un error de dominio sin mapear o un error desconocido es 500', () => {
    class Unmapped extends DomainError { }
    expect(statusFor(new Unmapped('x'))).toBe(500);
    expect(statusFor(new Error('boom'))).toBe(500);
    expect(statusFor('texto')).toBe(500);
    expect(statusFor(null)).toBe(500);
  });
});
