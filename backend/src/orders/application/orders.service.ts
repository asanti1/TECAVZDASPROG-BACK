import { Inject, Injectable } from '@nestjs/common';
import type { BranchCandidate, IBranchSelectionStrategy, RequestedItem } from '../../branches/domain/branch-selection.strategy.js';
import { BRANCH_SELECTION_STRATEGY } from '../../branches/domain/branch-selection.strategy.js';
import type { Branch } from '../../branches/domain/branch.js';
import type { IBranchRepository } from '../../branches/domain/branch.repository.js';
import { BRANCH_REPOSITORY } from '../../branches/domain/branch.repository.js';
import type { IStockRepository } from '../../branches/domain/stock.repository.js';
import { STOCK_REPOSITORY } from '../../branches/domain/stock.repository.js';
import { BranchNotFoundError } from '../../shared/errors.js';
import type { Coordinates } from '../../shared/geo/coordinates.js';
import type { IIdGenerator } from '../../shared/id-generator.js';
import { ID_GENERATOR } from '../../shared/id-generator.js';
import type { IUnitOfWork } from '../../shared/unit-of-work.js';
import { UNIT_OF_WORK } from '../../shared/unit-of-work.js';
import { OrderType } from '../domain/order-status.js';
import type { DeliveryAddress } from '../domain/order.js';
import { Order } from '../domain/order.js';
import type { IOrderRepository } from '../domain/order.repository.js';
import { ORDER_REPOSITORY } from '../domain/order.repository.js';

export interface CreateCustomerOrderInput {
  type: OrderType.CUSTOMER;
  customerId: string;
  deliveryAddress: DeliveryAddress;
  items: ReadonlyArray<RequestedItem>;
}

export interface CreateInterBranchOrderInput {
  type: OrderType.INTER_BRANCH;
  destinationBranchId: string;
  items: ReadonlyArray<RequestedItem>;
}

export type CreateOrderInput =
  CreateCustomerOrderInput | CreateInterBranchOrderInput;

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: IOrderRepository,
    @Inject(BRANCH_REPOSITORY) private readonly branches: IBranchRepository,
    @Inject(STOCK_REPOSITORY) private readonly stock: IStockRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(BRANCH_SELECTION_STRATEGY) private readonly branchSelection: IBranchSelectionStrategy,
    @Inject(ID_GENERATOR) private readonly ids: IIdGenerator,
  ) { }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    const destination = await this.resolveDestination(input);
    const candidates = await this.findCandidates(input);
    const originBranch = this.branchSelection.selectBranch({ items: input.items, destination: destination.location }, candidates);
    const order = this.buildOrder(input, originBranch);
    await this.unitOfWork.runInTransaction(async () => {
      await this.stock.reserve(originBranch.id, order.items);
      await this.orders.save(order);
    });

    return order;
  }

  private async resolveDestination(input: CreateOrderInput): Promise<{ location: Coordinates; branchId: string | null }> {
    if (input.type === OrderType.CUSTOMER) {
      return { location: input.deliveryAddress, branchId: null };
    }
    const branch = await this.branches.findById(input.destinationBranchId);
    if (!branch) {
      throw new BranchNotFoundError(`No existe la sucursal destino ${input.destinationBranchId}`);
    }
    return { location: branch.location, branchId: branch.id };
  }

  private async findCandidates(input: CreateOrderInput): Promise<BranchCandidate[]> {
    const candidates = await this.branches.findCandidatesWithStock(
      input.items.map((item) => item.productId),
    );
    if (input.type === OrderType.INTER_BRANCH) {
      return candidates.filter(({ branch }) => branch.id !== input.destinationBranchId);
    }
    return candidates;
  }

  private buildOrder(input: CreateOrderInput, originBranch: Branch): Order {
    const common = {
      id: this.ids.newId(),
      originBranchId: originBranch.id,
      items: input.items,
    };
    if (input.type === OrderType.CUSTOMER) {
      return new Order({
        ...common,
        type: OrderType.CUSTOMER,
        customerId: input.customerId,
        deliveryAddress: input.deliveryAddress,
      });
    }
    return new Order({
      ...common,
      type: OrderType.INTER_BRANCH,
      destinationBranchId: input.destinationBranchId,
    });
  }
}
