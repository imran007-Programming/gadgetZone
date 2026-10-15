import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ReturnStatus } from '@prisma/client';

export class CreateReturnDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: 'Defective item' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  reason: string;

  @ApiPropertyOptional({ example: 'Left earbud does not charge.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

export class UpdateReturnDto {
  @ApiProperty({ enum: ReturnStatus })
  @IsEnum(ReturnStatus)
  status: ReturnStatus;

  @ApiPropertyOptional({ example: 24800, description: 'Refund in BDT; defaults to the order total' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @ApiPropertyOptional({ example: 'Pickup booked for tomorrow.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

export class QueryReturnsDto {
  @ApiPropertyOptional({ enum: ReturnStatus })
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;
}
