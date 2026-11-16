import { ArrayMinSize, ArrayUnique, IsUUID } from 'class-validator';

export class CreateTripDto {
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  orderIds!: string[];
}
