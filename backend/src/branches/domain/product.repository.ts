export interface BranchStockLevel {
  branchId: string;
  quantity: number;
}

export interface ProductWithStock {
  id: string;
  name: string;
  sku: string;
  stock: ReadonlyArray<BranchStockLevel>;
}

export interface IProductRepository {
  findAllWithStock(): Promise<ProductWithStock[]>;
}

export const PRODUCT_REPOSITORY = Symbol('IProductRepository');
