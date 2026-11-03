import type { Branch } from '../../src/branches/domain/branch.js';
import type { IBranchRepository } from '../../src/branches/domain/branch.repository.js';
import type {
  BranchCandidate,
  RequestedItem,
} from '../../src/branches/domain/branch-selection.strategy.js';
import type { IStockRepository } from '../../src/branches/domain/stock.repository.js';
import type { Order } from '../../src/orders/domain/order.js';
import type { IOrderRepository } from '../../src/orders/domain/order.repository.js';
import { InsufficientStockError } from '../../src/shared/errors.js';
import type { IUnitOfWork } from '../../src/shared/unit-of-work.js';

export class InMemoryDatabase {
  readonly branches = new Map<string, Branch>();
  readonly stock = new Map<string, Map<string, number>>();
  readonly orders = new Map<string, Order>();

  addBranch(branch: Branch, stock: Record<string, number>): void {
    this.branches.set(branch.id, branch);
    this.stock.set(branch.id, new Map(Object.entries(stock)));
  }

  stockOf(branchId: string, productId: string): number {
    return this.stock.get(branchId)?.get(productId) ?? 0;
  }

  snapshot(): {
    stock: Map<string, Map<string, number>>;
    orders: Map<string, Order>;
  } {
    const stock = new Map<string, Map<string, number>>();
    for (const [branchId, perProduct] of this.stock) {
      stock.set(branchId, new Map(perProduct));
    }
    return { stock, orders: new Map(this.orders) };
  }

  restore(snapshot: ReturnType<InMemoryDatabase['snapshot']>): void {
    this.stock.clear();
    snapshot.stock.forEach((value, key) => this.stock.set(key, value));
    this.orders.clear();
    snapshot.orders.forEach((value, key) => this.orders.set(key, value));
  }
}

export class InMemoryBranchRepository implements IBranchRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findById(id: string): Promise<Branch | null> {
    return this.db.branches.get(id) ?? null;
  }

  async findCandidatesWithStock(
    productIds: ReadonlyArray<string>,
  ): Promise<BranchCandidate[]> {
    return [...this.db.branches.values()].map((branch) => ({
      branch,
      stock: new Map(
        productIds.map((productId) => [
          productId,
          this.db.stockOf(branch.id, productId),
        ]),
      ),
    }));
  }
}

export class InMemoryStockRepository implements IStockRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async reserve(
    branchId: string,
    items: ReadonlyArray<RequestedItem>,
  ): Promise<void> {
    for (const { productId, quantity } of items) {
      if (this.db.stockOf(branchId, productId) < quantity) {
        throw new InsufficientStockError(
          `Stock insuficiente de ${productId} en ${branchId}`,
        );
      }
    }
    for (const { productId, quantity } of items) {
      const perProduct = this.db.stock.get(branchId)!;
      perProduct.set(productId, perProduct.get(productId)! - quantity);
    }
  }
}

export class InMemoryOrderRepository implements IOrderRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async save(order: Order): Promise<void> {
    this.db.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.db.orders.get(id) ?? null;
  }
}

export class InMemoryUnitOfWork implements IUnitOfWork {
  constructor(private readonly db: InMemoryDatabase) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const before = this.db.snapshot();
    try {
      return await work();
    } catch (error) {
      this.db.restore(before);
      throw error;
    }
  }
}
