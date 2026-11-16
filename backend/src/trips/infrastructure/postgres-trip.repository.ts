import { Injectable } from '@nestjs/common';
import type { Coordinates } from '../../shared/geo/coordinates.js';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import { Route } from '../domain/route.js';
import type { TripStatus } from '../domain/trip-status.js';
import { Trip } from '../domain/trip.js';
import type { ITripRepository } from '../domain/trip.repository.js';

interface TripRow {
  id: string;
  delivery_person_id: string;
  origin_branch_id: string;
  status: TripStatus;
  departure_at: Date | null;
}

interface RouteRow {
  trip_id: string;
  order_id: string;
  sequence_order: number;
  geometry: Coordinates[];
  distance_km: number;
  estimated_time_min: number;
  algorithm_used: string;
}

interface OrderIdRow {
  id: string;
  trip_id: string;
}

@Injectable()
export class PostgresTripRepository implements ITripRepository {
  constructor(private readonly session: PostgresSession) { }

  save(trip: Trip): Promise<void> {
    return this.session.runInTransaction(async () => {
      await this.session.query(
        `INSERT INTO trips (
           id, delivery_person_id, origin_branch_id, status, departure_at
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET status = EXCLUDED.status, departure_at = EXCLUDED.departure_at`,
        [
          trip.id,
          trip.deliveryPersonId,
          trip.originBranchId,
          trip.status,
          trip.departureAt,
        ],
      );
      for (const route of trip.routes) {
        await this.session.query(
          `INSERT INTO routes (
             trip_id, order_id, sequence_order, geometry,
             distance_km, estimated_time_min, algorithm_used
           ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
           ON CONFLICT (trip_id, sequence_order) DO NOTHING`,
          [
            trip.id,
            route.toOrderId,
            route.sequenceOrder,
            JSON.stringify(route.geometry),
            route.distanceKm,
            route.estimatedTimeMin,
            route.algorithmUsed,
          ],
        );
      }
    });
  }

  async findById(id: string): Promise<Trip | null> {
    const { rows } = await this.session.query<TripRow>(
      `SELECT id, delivery_person_id, origin_branch_id, status, departure_at
         FROM trips WHERE id = $1`,
      [id],
    );
    const [trip] = await this.hydrate(rows);
    return trip ?? null;
  }

  async findAll(): Promise<Trip[]> {
    const { rows } = await this.session.query<TripRow>(
      `SELECT id, delivery_person_id, origin_branch_id, status, departure_at
         FROM trips ORDER BY created_at DESC, id`,
    );
    return this.hydrate(rows);
  }

  private async hydrate(rows: TripRow[]): Promise<Trip[]> {
    if (rows.length === 0) {
      return [];
    }
    const tripIds = rows.map((row) => row.id);
    const { rows: routeRows } = await this.session.query<RouteRow>(
      `SELECT trip_id, order_id, sequence_order, geometry, distance_km,
              estimated_time_min, algorithm_used
         FROM routes WHERE trip_id = ANY($1::uuid[])
        ORDER BY trip_id, sequence_order`,
      [tripIds],
    );
    const { rows: orderRows } = await this.session.query<OrderIdRow>(
      `SELECT id, trip_id FROM orders WHERE trip_id = ANY($1::uuid[])
        ORDER BY created_at, id`,
      [tripIds],
    );

    return rows.map(
      (row) => new Trip({
        id: row.id,
        deliveryPersonId: row.delivery_person_id,
        originBranchId: row.origin_branch_id,
        status: row.status,
        departureAt: row.departure_at,
        orderIds: orderRows.filter((order) => order.trip_id === row.id).map((order) => order.id),
        routes: routeRows.filter((route) => route.trip_id === row.id).map((route) => new Route({
          sequenceOrder: route.sequence_order,
          toOrderId: route.order_id,
          geometry: route.geometry,
          distanceKm: route.distance_km,
          estimatedTimeMin: route.estimated_time_min,
          algorithmUsed: route.algorithm_used,
        }),
        ),
      }),
    );
  }
}
