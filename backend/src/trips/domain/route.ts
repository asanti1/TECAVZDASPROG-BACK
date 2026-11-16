import { InvalidRouteError } from '../../shared/errors.js';
import type { Coordinates } from '../../shared/geo/coordinates.js';

export interface RouteProps {
  sequenceOrder: number;
  toOrderId: string;
  geometry: ReadonlyArray<Coordinates>;
  distanceKm: number;
  estimatedTimeMin: number;
  algorithmUsed: string;
}

const isValidPoint = (point: Coordinates): boolean =>
  Number.isFinite(point.latitude) && Number.isFinite(point.longitude);

export class Route {
  readonly sequenceOrder: number;
  readonly toOrderId: string;
  readonly geometry: ReadonlyArray<Coordinates>;
  readonly distanceKm: number;
  readonly estimatedTimeMin: number;
  readonly algorithmUsed: string;

  constructor(props: RouteProps) {
    if (!Number.isInteger(props.sequenceOrder) || props.sequenceOrder < 1) {
      throw new InvalidRouteError(
        `sequenceOrder inválido: ${props.sequenceOrder}`,
      );
    }
    if (props.toOrderId.trim() === '') {
      throw new InvalidRouteError('El tramo necesita el pedido de destino');
    }
    if (props.geometry.length < 2) {
      throw new InvalidRouteError('La geometría necesita al menos 2 puntos');
    }
    if (!props.geometry.every(isValidPoint)) {
      throw new InvalidRouteError('La geometría tiene coordenadas inválidas');
    }
    if (!Number.isFinite(props.distanceKm) || props.distanceKm < 0) {
      throw new InvalidRouteError(`Distancia inválida: ${props.distanceKm}`);
    }
    if (
      !Number.isInteger(props.estimatedTimeMin) ||
      props.estimatedTimeMin < 0
    ) {
      throw new InvalidRouteError(
        `Tiempo estimado inválido: ${props.estimatedTimeMin}`,
      );
    }
    if (props.algorithmUsed.trim() === '') {
      throw new InvalidRouteError('Falta indicar el algoritmo usado');
    }

    this.sequenceOrder = props.sequenceOrder;
    this.toOrderId = props.toOrderId;
    this.geometry = props.geometry.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
    }));
    this.distanceKm = props.distanceKm;
    this.estimatedTimeMin = props.estimatedTimeMin;
    this.algorithmUsed = props.algorithmUsed;
  }
}
