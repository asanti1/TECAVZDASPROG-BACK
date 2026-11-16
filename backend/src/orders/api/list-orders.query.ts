import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderStatus } from '../domain/order-status.js';

export class ListOrdersQuery {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
