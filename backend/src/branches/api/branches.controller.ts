import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { BranchProduct } from '../application/branches.service.js';
import { BranchesService } from '../application/branches.service.js';
import type { Branch } from '../domain/branch.js';
import type { ProductWithStock } from '../domain/product.repository.js';

@Controller()
export class BranchesController {
  constructor(private readonly service: BranchesService) { }

  @Get('branches')
  listBranches(): Promise<Branch[]> {
    return this.service.listBranches();
  }

  @Get('branches/:id/products')
  listBranchProducts(@Param('id', ParseUUIDPipe) id: string): Promise<BranchProduct[]> {
    return this.service.listBranchProducts(id);
  }

  @Get('products')
  listProducts(): Promise<ProductWithStock[]> {
    return this.service.listProductsWithStock();
  }
}
