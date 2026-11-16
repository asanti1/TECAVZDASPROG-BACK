import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { IdGeneratorModule } from '../shared/infrastructure/id-generator.module.js';
import { DatabaseModule } from '../shared/infrastructure/postgres/database.module.js';
import { TripsController } from './api/trips.controller.js';
import { TripPlanner } from './application/trip-planner.js';
import { TripsService } from './application/trips.service.js';
import { DELIVERY_ASSIGNMENT_STRATEGY, DELIVERY_PEOPLE_AVAILABILITY, FewestTripsDeliveryStrategy } from './domain/delivery-assignment.js';
import { ROUTE_OPTIMIZER } from './domain/route-optimizer.js';
import { TRIP_REPOSITORY } from './domain/trip.repository.js';
import { AmqpRouteOptimizer } from './infrastructure/messaging/amqp-route-optimizer.js';
import { RouteResultHandler } from './infrastructure/messaging/route-result-handler.js';
import { RouteResultsConsumer } from './infrastructure/messaging/route-results-consumer.js';
import { PostgresDeliveryPeopleAvailability } from './infrastructure/postgres-delivery-people-availability.js';
import { PostgresTripRepository } from './infrastructure/postgres-trip.repository.js';

@Module({
  imports: [DatabaseModule, BranchesModule, OrdersModule, IdGeneratorModule],
  controllers: [TripsController],
  providers: [TripPlanner, TripsService,
    { provide: TRIP_REPOSITORY, useClass: PostgresTripRepository },
    { provide: DELIVERY_PEOPLE_AVAILABILITY, useClass: PostgresDeliveryPeopleAvailability },
    { provide: DELIVERY_ASSIGNMENT_STRATEGY, useClass: FewestTripsDeliveryStrategy },
    { provide: ROUTE_OPTIMIZER, useClass: AmqpRouteOptimizer },
    RouteResultHandler,
    RouteResultsConsumer,
  ],
  exports: [TripsService],
})
export class TripsModule { }
