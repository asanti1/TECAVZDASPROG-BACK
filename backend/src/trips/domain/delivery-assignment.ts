import { NoDeliveryPersonAvailableError } from '../../shared/errors.js';

export interface DeliveryCandidate {
  id: string;
  completedTrips: number;
}

export interface IDeliveryPeopleAvailability {
  findAvailable(branchId: string): Promise<DeliveryCandidate[]>;
}

export interface IDeliveryAssignmentStrategy {
  select(candidates: ReadonlyArray<DeliveryCandidate>): DeliveryCandidate;
}

export const DELIVERY_PEOPLE_AVAILABILITY = Symbol(
  'IDeliveryPeopleAvailability',
);
export const DELIVERY_ASSIGNMENT_STRATEGY = Symbol(
  'IDeliveryAssignmentStrategy',
);


export class FewestTripsDeliveryStrategy implements IDeliveryAssignmentStrategy {
  select(candidates: ReadonlyArray<DeliveryCandidate>): DeliveryCandidate {
    if (candidates.length === 0) {
      throw new NoDeliveryPersonAvailableError(
        'No hay repartidores libres en la sucursal de origen',
      );
    }
    return [...candidates].sort(
      (a, b) => a.completedTrips - b.completedTrips || a.id.localeCompare(b.id),
    )[0] as DeliveryCandidate;
  }
}
