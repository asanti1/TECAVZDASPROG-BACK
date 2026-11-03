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

export class InvalidRouteError extends DomainError {}

export class InvalidRoutePlanError extends DomainError {}

export class BranchNotFoundError extends DomainError {}

export class InsufficientStockError extends DomainError {}
