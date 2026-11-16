import { Type } from 'class-transformer';
import { ArrayMinSize, IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import { OrderType } from '../domain/order-status.js';

export class OrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class DeliveryAddressDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  type!: OrderType;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ValidateIf((dto: CreateOrderDto) => dto.type === OrderType.CUSTOMER)
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @ValidateIf((dto: CreateOrderDto) => dto.type === OrderType.INTER_BRANCH)
  @IsUUID()
  destinationBranchId?: string;

  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
