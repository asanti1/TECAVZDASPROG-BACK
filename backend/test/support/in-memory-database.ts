import type { BranchCandidate, RequestedItem } from '../../src/branches/domain/branch-selection.strategy.js';
import type { Branch } from '../../src/branches/domain/branch.js';
import type { IBranchRepository } from '../../src/branches/domain/branch.repository.js';
import type { IProductRepository, ProductWithStock } from '../../src/branches/domain/product.repository.js';
import type { IStockRepository } from '../../src/branches/domain/stock.repository.js';
import type { Order } from '../../src/orders/domain/order.js';
import type { IOrderRepository, OrderFilter } from '../../src/orders/domain/order.repository.js';
import { InsufficientStockError } from '../../src/shared/errors.js';
import type { IUnitOfWork } from '../../src/shared/unit-of-work.js';
import type { Trip } from '../../src/trips/domain/trip.js';
import type { ITripRepository } from '../../src/trips/domain/trip.repository.js';

type StockByBranch = Map<string, Map<string, number>>;

interface Snapshot {
  stock: StockByBranch;
  orders: Map<string, Order>;
  trips: Map<string, Trip>;
}

export class InMemoryDatabase {
  readonly branches = new Map<string, Branch>();
  readonly stock: StockByBranch = new Map();
  readonly orders = new Map<string, Order>();
  readonly trips = new Map<string, Trip>();
  readonly products = new Map<string, { name: string; sku: string }>();

  addBranch(branch: Branch, stock: Record<string, number>): void {
    this.branches.set(branch.id, branch);
    this.stock.set(branch.id, new Map(Object.entries(stock)));
    for (const productId of Object.keys(stock)) {
      if (!this.products.has(productId)) {
        this.products.set(productId, {
          name: productId,
          sku: `sku-${productId}`,
        });
      }
    }
  }

  stockOf(branchId: string, productId: string): number {
    return this.stock.get(branchId)?.get(productId) ?? 0;
  }

  snapshot(): Snapshot {
    const stock: StockByBranch = new Map();
    for (const [branchId, perProduct] of this.stock) {
      stock.set(branchId, new Map(perProduct));
    }
    return { stock, orders: new Map(this.orders), trips: new Map(this.trips) };
  }

  restore(snapshot: Snapshot): void {
    this.stock.clear();
    snapshot.stock.forEach((value, key) => this.stock.set(key, value));
    this.orders.clear();
    snapshot.orders.forEach((value, key) => this.orders.set(key, value));
    this.trips.clear();
    snapshot.trips.forEach((value, key) => this.trips.set(key, value));
  }
}

export class InMemoryBranchRepository implements IBranchRepository {
  constructor(private readonly db: InMemoryDatabase) { }

  async findById(id: string): Promise<Branch | null> {
    return this.db.branches.get(id) ?? null;
  }

  async findAll(): Promise<Branch[]> {
    return [...this.db.branches.values()];
  }

  async findCandidatesWithStock(productIds: ReadonlyArray<string>): Promise<BranchCandidate[]> {
    return [...this.db.branches.values()].map((branch) => ({
      branch,
      stock: new Map(productIds.map((productId) => [productId, this.db.stockOf(branch.id, productId)])),
    }));
  }
}

export class InMemoryProductRepository implements IProductRepository {
  constructor(private readonly db: InMemoryDatabase) { }

  async findAllWithStock(): Promise<ProductWithStock[]> {
    return [...this.db.products].map(([id, product]) => ({
      id,
      name: product.name,
      sku: product.sku,
      stock: [...this.db.stock].filter(([, perProduct]) => perProduct.has(id)).map(([branchId, perProduct]) => ({
        branchId,
        quantity: perProduct.get(id)!,
      })),
    }));
  }
}

export class InMemoryStockRepository implements IStockRepository {
  constructor(private readonly db: InMemoryDatabase) { }

  async reserve(branchId: string, items: ReadonlyArray<RequestedItem>): Promise<void> {
    for (const { productId, quantity } of items) {
      if (this.db.stockOf(branchId, productId) < quantity) {
        throw new InsufficientStockError(`Stock insuficiente de ${productId} en ${branchId}`);
      }
    }
    for (const { productId, quantity } of items) {
      const perProduct = this.db.stock.get(branchId)!;
      perProduct.set(productId, perProduct.get(productId)! - quantity);
    }
  }
}

export class InMemoryOrderRepository implements IOrderRepository {
  constructor(private readonly db: InMemoryDatabase) { }

  async save(order: Order): Promise<void> {
    this.db.orders.set(order.id, order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.db.orders.get(id) ?? null;
  }

  async findByIds(ids: ReadonlyArray<string>): Promise<Order[]> {
    return ids.map((id) => this.db.orders.get(id)).filter((order): order is Order => order !== undefined)
      .filter((order, index, all) => all.indexOf(order) === index);
  }

  async findAll(filter: OrderFilter): Promise<Order[]> {
    return [...this.db.orders.values()].filter((order) =>
      (filter.status === undefined || order.status === filter.status) &&
      (filter.originBranchId === undefined ||
        order.originBranchId === filter.originBranchId) &&
      (filter.customerId === undefined ||
        order.customerId === filter.customerId),
    );
  }
}

export class InMemoryTripRepository implements ITripRepository {
  constructor(private readonly db: InMemoryDatabase) { }

  async save(trip: Trip): Promise<void> {
    this.db.trips.set(trip.id, trip);
  }

  async findById(id: string): Promise<Trip | null> {
    return this.db.trips.get(id) ?? null;
  }

  async findAll(): Promise<Trip[]> {
    return [...this.db.trips.values()];
  }
}

export class InMemoryUnitOfWork implements IUnitOfWork {
  constructor(private readonly db: InMemoryDatabase) { }

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
