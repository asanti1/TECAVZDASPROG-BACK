import { Injectable } from '@nestjs/common';
import { PostgresSession } from '../../shared/infrastructure/postgres/postgres-session.js';
import type { DeliveryCandidate, IDeliveryPeopleAvailability } from '../domain/delivery-assignment.js';

interface CandidateRow {
  id: string;
  completed_trips: number;
}

@Injectable()
export class PostgresDeliveryPeopleAvailability implements IDeliveryPeopleAvailability {
  constructor(private readonly session: PostgresSession) { }

  async findAvailable(branchId: string): Promise<DeliveryCandidate[]> {
    const result = await this.session.query<CandidateRow>(
      `SELECT u.id,
              COUNT(t.id) FILTER (WHERE t.status = 'completed')::int AS completed_trips
         FROM users u
         LEFT JOIN trips t ON t.delivery_person_id = u.id
        WHERE u.role = 'DELIVERY_PERSON' AND u.branch_id = $1
        GROUP BY u.id
       HAVING COUNT(t.id) FILTER (WHERE t.status IN ('planned', 'in_progress')) = 0`,
      [branchId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      completedTrips: row.completed_trips,
    }));
  }
}
