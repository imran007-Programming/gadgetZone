import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateCouponDto {
  @ApiProperty({ example: 'EID15' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_-]{3,30}$/, {
    message: 'Code must be 3–30 characters: letters, numbers, "-" or "_"',
  })
  code: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  type: DiscountType;

  @ApiProperty({ example: 15, description: 'Percent (1–100) or flat BDT amount' })
  @IsNumber()
  @IsPositive()
  value: number;

  @ApiPropertyOptional({ example: 2000, description: 'Minimum order subtotal in BDT' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number | null;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ValidateCouponDto {
  @ApiProperty({ example: 'EID15' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 4500, description: 'Cart subtotal in BDT' })
  @IsNumber()
  @Min(0)
  subtotal: number;
}
