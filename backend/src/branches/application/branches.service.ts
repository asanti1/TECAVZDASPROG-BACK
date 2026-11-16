import { Inject, Injectable } from '@nestjs/common';
import { BranchNotFoundError } from '../../shared/errors.js';
import type { Branch } from '../domain/branch.js';
import type { IBranchRepository } from '../domain/branch.repository.js';
import { BRANCH_REPOSITORY } from '../domain/branch.repository.js';
import type { IProductRepository, ProductWithStock } from '../domain/product.repository.js';
import { PRODUCT_REPOSITORY } from '../domain/product.repository.js';

@Injectable()
export class BranchesService {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branches: IBranchRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly products: IProductRepository,
  ) { }

  listBranches(): Promise<Branch[]> {
    return this.branches.findAll();
  }

  listProductsWithStock(): Promise<ProductWithStock[]> {
    return this.products.findAllWithStock();
  }

  async listBranchProducts(branchId: string): Promise<BranchProduct[]> {
    if ((await this.branches.findById(branchId)) === null) {
      throw new BranchNotFoundError(`No existe la sucursal ${branchId}`);
    }
    const products = await this.products.findAllWithStock();
    return products.flatMap((product) => {
      const level = product.stock.find((s) => s.branchId === branchId);
      return level === undefined
        ? []
        : [
          {
            id: product.id,
            name: product.name,
            sku: product.sku,
            quantity: level.quantity,
          },
        ];
    });
  }
}

export interface BranchProduct {
  id: string;
  name: string;
  sku: string;
  quantity: number;
}
