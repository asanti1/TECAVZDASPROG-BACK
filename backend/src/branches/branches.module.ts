import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/infrastructure/postgres/database.module.js';
import { BranchesController } from './api/branches.controller.js';
import { BranchesService } from './application/branches.service.js';
import { BRANCH_SELECTION_STRATEGY } from './domain/branch-selection.strategy.js';
import { BRANCH_REPOSITORY } from './domain/branch.repository.js';
import { NearestBranchWithStockStrategy } from './domain/nearest-branch-with-stock.strategy.js';
import { PRODUCT_REPOSITORY } from './domain/product.repository.js';
import { STOCK_REPOSITORY } from './domain/stock.repository.js';
import { PostgresBranchRepository } from './infrastructure/postgres-branch.repository.js';
import { PostgresProductRepository } from './infrastructure/postgres-product.repository.js';
import { PostgresStockRepository } from './infrastructure/postgres-stock.repository.js';

@Module({
  imports: [DatabaseModule],
  controllers: [BranchesController],
  providers: [
    BranchesService,
    { provide: PRODUCT_REPOSITORY, useClass: PostgresProductRepository },
    { provide: BRANCH_REPOSITORY, useClass: PostgresBranchRepository },
    { provide: STOCK_REPOSITORY, useClass: PostgresStockRepository },
    { provide: BRANCH_SELECTION_STRATEGY, useClass: NearestBranchWithStockStrategy },
  ],
  exports: [BRANCH_REPOSITORY, STOCK_REPOSITORY, BRANCH_SELECTION_STRATEGY],
})
export class BranchesModule { }
