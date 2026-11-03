import {
  InvalidRoutePlanError,
  InvalidTripError,
  InvalidTripTransitionError,
} from '../../shared/errors.js';
import type { Route } from './route.js';
import type { RoutePlan } from './route-plan.js';
import { TripStatus } from './trip-status.js';

export interface TripProps {
  id: string;
  deliveryPersonId: string;
  originBranchId: string;
  orderIds: ReadonlyArray<string>;
  status?: TripStatus;
  departureAt?: Date | null;
  routes?: ReadonlyArray<Route>;
}

const bySequence = (a: Route, b: Route): number => a.sequenceOrder - b.sequenceOrder;

export class Trip {
  readonly id: string;
  readonly deliveryPersonId: string;
  readonly originBranchId: string;
  readonly orderIds: ReadonlyArray<string>;

  private _status: TripStatus;
  private _departureAt: Date | null;
  private _routes: ReadonlyArray<Route>;

  constructor(props: TripProps) {
    this.id = props.id;
    this.deliveryPersonId = props.deliveryPersonId;
    this.originBranchId = props.originBranchId;
    this.orderIds = [...props.orderIds];
    this._status = props.status ?? TripStatus.PLANNED;
    this._departureAt = props.departureAt ?? null;
    this._routes = [...(props.routes ?? [])].sort(bySequence);

    this.validateIdentity();
    this.validateOrders();
    if (this._routes.length > 0) {
      this.assertLegsMatch(this._routes);
    }
    this.validateStatusConsistency();
  }

  get status(): TripStatus {
    return this._status;
  }

  get departureAt(): Date | null {
    return this._departureAt ? new Date(this._departureAt) : null;
  }

  get routes(): ReadonlyArray<Route> {
    return [...this._routes];
  }

  attachRoutePlan(plan: RoutePlan): boolean {
    if (plan.tripId !== this.id) {
      throw new InvalidRoutePlanError(`El plan es del viaje ${plan.tripId}, no del ${this.id}`);
    }

    if (this._routes.length > 0) return false;

    const legs = [...plan.legs].sort(bySequence);
    this.assertLegsMatch(legs);
    this._routes = legs;
    return true;
  }

  start(at: Date): void {
    if (Number.isNaN(at.getTime())) {
      throw new InvalidTripError('Fecha de salida inválida');
    }
    if (this._status !== TripStatus.PLANNED) {
      throw new InvalidTripTransitionError(`Trip ${this.id}: no se puede iniciar desde '${this._status}'`);
    }

    if (this._routes.length === 0) {
      throw new InvalidTripTransitionError(`Trip ${this.id}: no se puede iniciar sin rutas calculadas`);
    }

    this._status = TripStatus.IN_PROGRESS;
    this._departureAt = new Date(at);
  }

  complete(): void {
    if (this._status !== TripStatus.IN_PROGRESS) {
      throw new InvalidTripTransitionError(`Trip ${this.id}: no se puede completar desde '${this._status}'`);
    }

    this._status = TripStatus.COMPLETED;
  }

  private assertLegsMatch(legs: ReadonlyArray<Route>): void {
    if (legs.length !== this.orderIds.length) {
      throw new InvalidRoutePlanError(`Se esperaban ${this.orderIds.length} tramos y llegaron ${legs.length}`);
    }

    legs.forEach((leg, index) => {
      if (leg.sequenceOrder !== index + 1) {
        throw new InvalidRoutePlanError('La secuencia de tramos debe ser 1..N, sin huecos ni repetidos');
      }
    });

    const pending = new Set(this.orderIds);
    for (const leg of legs) {
      if (!pending.delete(leg.toOrderId)) {
        throw new InvalidRoutePlanError(`El tramo ${leg.sequenceOrder} va al pedido ${leg.toOrderId}, que no es del viaje o está repetido`);
      }
    }
  }

  private validateIdentity(): void {
    if (this.id.trim() === '' || this.deliveryPersonId.trim() === '' || this.originBranchId.trim() === '') {
      throw new InvalidTripError('El viaje necesita id, repartidor y sucursal de origen');
    }
  }

  private validateOrders(): void {
    if (this.orderIds.length === 0) {
      throw new InvalidTripError('Un viaje necesita al menos un pedido');
    }
    if (new Set(this.orderIds).size !== this.orderIds.length) {
      throw new InvalidTripError('El viaje repite un pedido');
    }
  }

  private validateStatusConsistency(): void {
    if (this._status === TripStatus.PLANNED) {
      if (this._departureAt !== null) {
        throw new InvalidTripError('Un viaje planned no puede tener fecha de salida');
      }
      return;
    }
    if (this._departureAt === null) {
      throw new InvalidTripError(`Un viaje '${this._status}' requiere fecha de salida`);
    }
    if (this._routes.length === 0) {
      throw new InvalidTripError(`Un viaje '${this._status}' requiere rutas calculadas`);
    }
  }
}
