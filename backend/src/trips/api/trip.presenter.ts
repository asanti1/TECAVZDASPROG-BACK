import type { Trip } from '../domain/trip.js';

export function presentTrip(trip: Trip) {
  return {
    id: trip.id,
    deliveryPersonId: trip.deliveryPersonId,
    originBranchId: trip.originBranchId,
    status: trip.status,
    departureAt: trip.departureAt?.toISOString() ?? null,
    orderIds: trip.orderIds,
    routesReady: trip.routes.length > 0,
    routes: trip.routes.map((route) => ({
      sequenceOrder: route.sequenceOrder,
      toOrderId: route.toOrderId,
      geometry: route.geometry,
      distanceKm: route.distanceKm,
      estimatedTimeMin: route.estimatedTimeMin,
      algorithmUsed: route.algorithmUsed,
    })),
  };
}

export function presentTripRoute(trip: Trip) {
  const legs = presentTrip(trip).routes;
  return {
    tripId: trip.id,
    routesReady: legs.length > 0,
    totalDistanceKm:
      Math.round(legs.reduce((sum, leg) => sum + leg.distanceKm, 0) * 1000) /
      1000,
    totalTimeMin: legs.reduce((sum, leg) => sum + leg.estimatedTimeMin, 0),
    legs,
  };
}
