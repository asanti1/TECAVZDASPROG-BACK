import { Module } from '@nestjs/common';
import { TripsModule } from '../trips/trips.module.js';
import { TrackingController } from './api/tracking.controller.js';
import { TrackingGateway } from './api/tracking.gateway.js';
import { TrackingService } from './application/tracking.service.js';
import { LOCATION_STORE } from './domain/location-store.js';
import { InMemoryLocationStore } from './infrastructure/in-memory-location-store.js';

@Module({
  imports: [TripsModule],
  controllers: [TrackingController],
  providers: [TrackingService, TrackingGateway,
    { provide: LOCATION_STORE, useClass: InMemoryLocationStore },
  ],
})
export class TrackingModule { }
