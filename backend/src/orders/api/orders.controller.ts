import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { CurrentUser, Roles } from '../../shared/auth/decorators.js';
import { UserRole } from '../../shared/auth/role.js';
import type { CreateOrderInput } from '../application/orders.service.js';
import { OrdersService } from '../application/orders.service.js';
import { OrderType } from '../domain/order-status.js';
import { CreateOrderDto } from './create-order.dto.js';
import { ListOrdersQuery } from './list-orders.query.js';
import { assertCanSeeOrder, customerIdFor, customerScope } from './order-access.js';
import { presentOrder } from './order.presenter.js';

@Controller('orders')
@Roles(UserRole.ADMIN, UserRole.CUSTOMER)
export class OrdersController {
  constructor(private readonly service: OrdersService) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return presentOrder(
      await this.service.createOrder(toInput(dto, customerIdFor(user, dto))),
    );
  }

  @Get()
  async list(@Query() query: ListOrdersQuery, @CurrentUser() user: AuthenticatedUser) {
    const orders = await this.service.findAll({
      status: query.status,
      originBranchId: query.branchId,
      customerId: customerScope(user),
    });
    return orders.map(presentOrder);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const order = await this.service.findById(id);
    assertCanSeeOrder(user, order);
    return presentOrder(order);
  }
}

function toInput(dto: CreateOrderDto, customerId: string | undefined): CreateOrderInput {
  if (dto.type === OrderType.CUSTOMER) {
    return {
      type: OrderType.CUSTOMER,
      customerId: customerId as string,
      deliveryAddress: dto.deliveryAddress as NonNullable<CreateOrderDto['deliveryAddress']>,
      items: dto.items,
    };
  }
  return {
    type: OrderType.INTER_BRANCH,
    destinationBranchId: dto.destinationBranchId as string,
    items: dto.items,
  };
}
