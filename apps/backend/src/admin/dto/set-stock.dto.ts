import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SetStockDto {
  @ApiProperty({ example: 25, description: 'New stock level (replaces current)' })
  @IsInt()
  @Min(0)
  stock: number;
}
