import type { RequestedItem } from './branch-selection.strategy.js';

export interface IStockRepository {
  reserve(branchId: string, items: ReadonlyArray<RequestedItem>): Promise<void>;
}

export const STOCK_REPOSITORY = Symbol('IStockRepository');
