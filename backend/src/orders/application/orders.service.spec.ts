import { Test } from '@nestjs/testing';
import { InMemoryBranchRepository, InMemoryDatabase, InMemoryOrderRepository, InMemoryStockRepository, InMemoryUnitOfWork } from '../../../test/support/in-memory-database.js';
import type { IBranchSelectionStrategy } from '../../branches/domain/branch-selection.strategy.js';
import { BRANCH_SELECTION_STRATEGY } from '../../branches/domain/branch-selection.strategy.js';
import type { Branch } from '../../branches/domain/branch.js';
import { BRANCH_REPOSITORY } from '../../branches/domain/branch.repository.js';
import { NearestBranchWithStockStrategy } from '../../branches/domain/nearest-branch-with-stock.strategy.js';
import type { IStockRepository } from '../../branches/domain/stock.repository.js';
import { STOCK_REPOSITORY } from '../../branches/domain/stock.repository.js';
import { BranchNotFoundError, InsufficientStockError, NoBranchAvailableError } from '../../shared/errors.js';
import { ID_GENERATOR } from '../../shared/id-generator.js';
import { UNIT_OF_WORK } from '../../shared/unit-of-work.js';
import { OrderStatus, OrderType } from '../domain/order-status.js';
import type { IOrderRepository } from '../domain/order.repository.js';
import { ORDER_REPOSITORY } from '../domain/order.repository.js';
import type { CreateCustomerOrderInput } from './orders.service.js';
import { OrdersService } from './orders.service.js';

const buenosAires: Branch = {
  id: 'b-ba',
  name: 'Buenos Aires',
  location: { latitude: -34.6, longitude: -58.4 },
};
const cordoba: Branch = {
  id: 'b-cba',
  name: 'Córdoba',
  location: { latitude: -31.4, longitude: -64.2 },
};
const bahiaBlanca: Branch = {
  id: 'b-bb',
  name: 'Bahía Blanca',
  location: { latitude: -38.7, longitude: -62.3 },
};

const addressNearBahiaBlanca = {
  latitude: -38.6,
  longitude: -62.2,
};

const customerInput = (overrides: Partial<CreateCustomerOrderInput> = {}): CreateCustomerOrderInput => ({
  type: OrderType.CUSTOMER,
  customerId: 'c1',
  deliveryAddress: addressNearBahiaBlanca,
  items: [{ productId: 'p1', quantity: 2 }],
  ...overrides,
});

class Fixture {
  readonly db = new InMemoryDatabase();
  private nextId = 0;

  constructor() {
    this.db.addBranch(buenosAires, { p1: 10, p2: 10 });
    this.db.addBranch(cordoba, { p1: 10, p2: 10 });
    this.db.addBranch(bahiaBlanca, { p1: 10, p2: 10 });
  }

  service(overrides:
    {
      orders?: IOrderRepository;
      stock?: IStockRepository;
      strategy?: IBranchSelectionStrategy;
    } = {},
  ): OrdersService {
    return new OrdersService(
      overrides.orders ?? new InMemoryOrderRepository(this.db),
      new InMemoryBranchRepository(this.db),
      overrides.stock ?? new InMemoryStockRepository(this.db),
      new InMemoryUnitOfWork(this.db),
      overrides.strategy ?? new NearestBranchWithStockStrategy(),
      { newId: () => `order-${++this.nextId}` },
    );
  }
}

describe('OrdersService.createOrder: pedido a cliente', () => {
  it('elige la sucursal más cercana con stock y crea el pedido pendiente', async () => {
    const fixture = new Fixture();

    const order = await fixture.service().createOrder(customerInput());

    expect(order.id).toBe('order-1');
    expect(order.originBranchId).toBe('b-bb');
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.customerId).toBe('c1');
    expect(order.items).toEqual([{ productId: 'p1', quantity: 2 }]);
    expect(fixture.db.orders.get('order-1')).toBe(order);
  });

  it('descuenta el stock solo en la sucursal elegida', async () => {
    const fixture = new Fixture();

    await fixture.service().createOrder(customerInput());

    expect(fixture.db.stockOf('b-bb', 'p1')).toBe(8);
    expect(fixture.db.stockOf('b-ba', 'p1')).toBe(10);
    expect(fixture.db.stockOf('b-cba', 'p1')).toBe(10);
  });

  it('salta a la siguiente sucursal cuando la más cercana no tiene stock', async () => {
    const fixture = new Fixture();
    fixture.db.stock.get('b-bb')!.set('p1', 1);

    const order = await fixture.service().createOrder(customerInput());

    expect(order.originBranchId).toBe('b-ba');
    expect(fixture.db.stockOf('b-bb', 'p1')).toBe(1);
    expect(fixture.db.stockOf('b-ba', 'p1')).toBe(8);
  });

  it('respeta la sucursal que devuelve la estrategia', async () => {
    const fixture = new Fixture();
    const alwaysCordoba: IBranchSelectionStrategy = {
      selectBranch: () => cordoba,
    };

    const order = await fixture
      .service({ strategy: alwaysCordoba })
      .createOrder(customerInput());

    expect(order.originBranchId).toBe('b-cba');
    expect(fixture.db.stockOf('b-cba', 'p1')).toBe(8);
  });

  it('falla sin tocar nada si ninguna sucursal puede cumplir el pedido completo', async () => {
    const fixture = new Fixture();

    await expect(fixture.service().createOrder(customerInput({ items: [{ productId: 'p1', quantity: 11 }] }))).rejects.toThrow(NoBranchAvailableError);

    expect(fixture.db.orders.size).toBe(0);
    expect(fixture.db.stockOf('b-bb', 'p1')).toBe(10);
  });
});

describe('OrdersService.createOrder: pedido entre sucursales', () => {
  const interBranchInput = (destinationBranchId: string) => ({
    type: OrderType.INTER_BRANCH as const,
    destinationBranchId,
    items: [{ productId: 'p1', quantity: 2 }],
  });

  it('crea un pedido que repone a la sucursal destino desde otra sucursal', async () => {
    const fixture = new Fixture();

    const order = await fixture.service().createOrder(interBranchInput('b-bb'));

    expect(order.type).toBe(OrderType.INTER_BRANCH);
    expect(order.destinationBranchId).toBe('b-bb');
    expect(order.customerId).toBeNull();
    expect(order.originBranchId).not.toBe('b-bb');
  });

  it('nunca elige a la sucursal destino como origen, aunque sea la más cercana y tenga stock', async () => {
    const fixture = new Fixture();

    const order = await fixture.service().createOrder(interBranchInput('b-ba'));

    expect(order.originBranchId).toBe('b-bb');
    expect(fixture.db.stockOf('b-ba', 'p1')).toBe(10);
  });

  it('falla si la sucursal destino no existe, sin tocar nada', async () => {
    const fixture = new Fixture();

    await expect(fixture.service().createOrder(interBranchInput('fantasma'))).rejects.toThrow(BranchNotFoundError);

    expect(fixture.db.orders.size).toBe(0);
    expect(fixture.db.stockOf('b-bb', 'p1')).toBe(10);
  });
});

describe('OrdersService.createOrder: atomicidad', () => {
  it('si falla el guardado del pedido, el stock vuelve a su valor original', async () => {
    const fixture = new Fixture();
    const failingOrders: IOrderRepository = {
      save: () => Promise.reject(new Error('base caída')),
      findById: () => Promise.resolve(null),
      findByIds: () => Promise.resolve([]),
      findAll: () => Promise.resolve([]),
    };

    await expect(fixture.service({ orders: failingOrders }).createOrder(customerInput())).rejects.toThrow('base caída');

    expect(fixture.db.stockOf('b-bb', 'p1')).toBe(10);
    expect(fixture.db.orders.size).toBe(0);
  });

  it('si el stock se agotó entre la elección y la reserva, no guarda el pedido', async () => {
    const fixture = new Fixture();
    const stockTakenByAnotherOrder: IStockRepository = {
      reserve: () => Promise.reject(new InsufficientStockError('agotado')),
    };

    await expect(fixture.service({ stock: stockTakenByAnotherOrder }).createOrder(customerInput())).rejects.toThrow(InsufficientStockError);

    expect(fixture.db.orders.size).toBe(0);
  });
});

describe('OrdersService bajo el contenedor de Nest', () => {
  it('recibe las seis dependencias por token', async () => {
    const db = new InMemoryDatabase();
    db.addBranch(bahiaBlanca, { p1: 5 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: ORDER_REPOSITORY,
          useValue: new InMemoryOrderRepository(db),
        },
        {
          provide: BRANCH_REPOSITORY,
          useValue: new InMemoryBranchRepository(db),
        },
        {
          provide: STOCK_REPOSITORY,
          useValue: new InMemoryStockRepository(db),
        },
        { provide: UNIT_OF_WORK, useValue: new InMemoryUnitOfWork(db) },
        {
          provide: BRANCH_SELECTION_STRATEGY,
          useClass: NearestBranchWithStockStrategy,
        },
        { provide: ID_GENERATOR, useValue: { newId: () => 'order-di' } },
      ],
    }).compile();

    const order = await moduleRef.get(OrdersService).createOrder(customerInput());

    expect(order.id).toBe('order-di');
    expect(db.stockOf('b-bb', 'p1')).toBe(3);
  });
});
