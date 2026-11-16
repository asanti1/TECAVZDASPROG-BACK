import type { RoutePlan, RoutePlanRequest } from '../../domain/route-plan.js';
import { Route } from '../../domain/route.js';

export class MalformedMessageError extends Error {}

export function serializeRequest(request: RoutePlanRequest): Buffer {
  return Buffer.from(JSON.stringify(request));
}

type Json = Record<string, unknown>;

function asObject(value: unknown, what: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MalformedMessageError(`${what} debe ser un objeto`);
  }
  return value as Json;
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new MalformedMessageError(`${what} debe ser un texto`);
  }
  return value;
}

function asNumber(value: unknown, what: string): number {
  if (typeof value !== 'number') {
    throw new MalformedMessageError(`${what} debe ser un número`);
  }
  return value;
}

function toLeg(raw: unknown): Route {
  const leg = asObject(raw, 'el tramo');
  if (!Array.isArray(leg.geometry)) {
    throw new MalformedMessageError('geometry debe ser una lista');
  }
  const geometry = (leg.geometry as unknown[]).map((point) => {
    const p = asObject(point, 'el punto');
    return {
      latitude: asNumber(p.latitude, 'latitude'),
      longitude: asNumber(p.longitude, 'longitude'),
    };
  });
  return new Route({
    sequenceOrder: asNumber(leg.sequenceOrder, 'sequenceOrder'),
    toOrderId: asString(leg.toOrderId, 'toOrderId'),
    geometry,
    distanceKm: asNumber(leg.distanceKm, 'distanceKm'),
    estimatedTimeMin: asNumber(leg.estimatedTimeMin, 'estimatedTimeMin'),
    algorithmUsed: asString(leg.algorithmUsed, 'algorithmUsed'),
  });
}

export function parseRoutePlan(content: Buffer): RoutePlan {
  let body: unknown;
  try {
    body = JSON.parse(content.toString('utf8'));
  } catch {
    throw new MalformedMessageError('El mensaje no es JSON válido');
  }
  const message = asObject(body, 'El mensaje');
  if (!Array.isArray(message.legs)) {
    throw new MalformedMessageError('legs debe ser una lista');
  }
  
  return {
    tripId: asString(message.tripId, 'tripId'),
    legs: (message.legs as unknown[]).map(toLeg),
  };
}
