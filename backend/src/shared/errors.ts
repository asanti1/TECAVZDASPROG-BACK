export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidOrderError extends DomainError {}

export class InvalidOrderTransitionError extends DomainError {}

export class NoBranchAvailableError extends DomainError {}

export class InvalidTripError extends DomainError {}

export class InvalidTripTransitionError extends DomainError {}

export class NoDeliveryPersonAvailableError extends DomainError {}

export class InvalidLocationError extends DomainError {}

export class InvalidRouteError extends DomainError {}

export class InvalidRoutePlanError extends DomainError {}

export class BranchNotFoundError extends DomainError {}

export class InsufficientStockError extends DomainError {}

export class OrderNotFoundError extends DomainError {}

export class TripNotFoundError extends DomainError {}

export class AuthenticationError extends DomainError {}

export class ForbiddenActionError extends DomainError {}
