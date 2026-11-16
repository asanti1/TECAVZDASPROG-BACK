import { InvalidOrderError, InvalidOrderTransitionError } from '../../shared/errors.js';
import type { Coordinates } from '../../shared/geo/coordinates.js';
import { OrderStatus, OrderType } from './order-status.js';

export interface OrderItem {
  productId: string;
  quantity: number;
}

export type DeliveryAddress = Coordinates;

export interface OrderProps {
  id: string;
  type: OrderType;
  originBranchId: string;
  items: ReadonlyArray<OrderItem>;
  destinationBranchId?: string | null;
  customerId?: string | null;
  deliveryAddress?: DeliveryAddress | null;
  status?: OrderStatus;
  tripId?: string | null;
  createdAt?: Date;
}

export class Order {
  readonly id: string;
  readonly type: OrderType;
  readonly originBranchId: string;
  readonly destinationBranchId: string | null;
  readonly customerId: string | null;
  readonly deliveryAddress: DeliveryAddress | null;
  readonly items: ReadonlyArray<OrderItem>;
  readonly createdAt: Date;

  private _status: OrderStatus;
  private _tripId: string | null;

  constructor(props: OrderProps) {
    this.id = props.id;
    this.type = props.type;
    this.originBranchId = props.originBranchId;
    this.destinationBranchId = props.destinationBranchId ?? null;
    this.customerId = props.customerId ?? null;
    this.deliveryAddress = props.deliveryAddress ?? null;
    this.items = props.items.map((item) => ({ ...item }));
    this._status = props.status ?? OrderStatus.PENDING;
    this._tripId = props.tripId ?? null;
    this.createdAt = props.createdAt ?? new Date();

    this.validateItems();
    this.validateTarget();
    this.validateTripConsistency();
  }

  get status(): OrderStatus {
    return this._status;
  }

  get tripId(): string | null {
    return this._tripId;
  }

  assignToTrip(tripId: string): void {
    this.requireStatus(OrderStatus.PENDING, OrderStatus.ASSIGNED);
    this._tripId = tripId;
    this._status = OrderStatus.ASSIGNED;
  }

  startTrip(): void {
    this.requireStatus(OrderStatus.ASSIGNED, OrderStatus.IN_TRIP);
    this._status = OrderStatus.IN_TRIP;
  }

  markDelivered(): void {
    this.requireStatus(OrderStatus.IN_TRIP, OrderStatus.DELIVERED);
    this._status = OrderStatus.DELIVERED;
  }

  private requireStatus(expected: OrderStatus, target: OrderStatus): void {
    if (this._status !== expected) {
      throw new InvalidOrderTransitionError(`Order ${this.id}: no se puede pasar de '${this._status}' a '${target}' (requiere '${expected}')`);
    }
  }

  private validateItems(): void {
    if (this.items.length === 0) {
      throw new InvalidOrderError('El pedido debe tener al menos un producto');
    }
    for (const item of this.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new InvalidOrderError(`Cantidad inválida para el producto ${item.productId}: ${item.quantity}`);
      }
    }
    const ids = new Set(this.items.map((item) => item.productId));
    if (ids.size !== this.items.length) {
      throw new InvalidOrderError('El pedido repite un producto');
    }
  }

  private validateTarget(): void {
    if (this.type === OrderType.CUSTOMER) {
      if (!this.customerId || !this.deliveryAddress) {
        throw new InvalidOrderError('Un pedido CUSTOMER requiere cliente y dirección de entrega');
      }
      if (this.destinationBranchId) {
        throw new InvalidOrderError('Un pedido CUSTOMER no puede tener sucursal destino');
      }
      return;
    }
    if (!this.destinationBranchId) {
      throw new InvalidOrderError('Un pedido INTER_BRANCH requiere sucursal destino');
    }
    if (this.destinationBranchId === this.originBranchId) {
      throw new InvalidOrderError('La sucursal destino no puede ser la misma que la de origen');
    }
    if (this.customerId) {
      throw new InvalidOrderError('Un pedido INTER_BRANCH no puede tener cliente');
    }
  }

  private validateTripConsistency(): void {
    const isPending = this._status === OrderStatus.PENDING;
    if (isPending && this._tripId !== null) {
      throw new InvalidOrderError('Un pedido pending no puede tener viaje');
    }
    if (!isPending && this._tripId === null) {
      throw new InvalidOrderError(`Un pedido '${this._status}' requiere tener viaje`);
    }
  }
}
