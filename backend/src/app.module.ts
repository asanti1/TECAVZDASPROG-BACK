import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { BranchesModule } from './branches/branches.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { HttpErrorFilter } from './shared/http/http-error.filter.js';
import { TrackingModule } from './tracking/tracking.module.js';
import { TripsModule } from './trips/trips.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [AuthModule, BranchesModule, OrdersModule, TripsModule, TrackingModule, UsersModule],
  providers: [
    { provide: APP_FILTER, useClass: HttpErrorFilter },
    {
      provide: APP_PIPE, useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    },
  ],
})
export class AppModule { }
