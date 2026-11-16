import { Module } from '@nestjs/common';
import { BranchesModule } from '../branches/branches.module.js';
import { IdGeneratorModule } from '../shared/infrastructure/id-generator.module.js';
import { DatabaseModule } from '../shared/infrastructure/postgres/database.module.js';
import { OrdersController } from './api/orders.controller.js';
import { OrdersService } from './application/orders.service.js';
import { ORDER_REPOSITORY } from './domain/order.repository.js';
import { PostgresOrderRepository } from './infrastructure/postgres-order.repository.js';

@Module({
  imports: [DatabaseModule, BranchesModule, IdGeneratorModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    { provide: ORDER_REPOSITORY, useClass: PostgresOrderRepository },
  ],
  exports: [OrdersService, ORDER_REPOSITORY],
})
export class OrdersModule {}
