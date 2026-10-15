import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

/** Partial update — every field optional. */
export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Trail Runner X1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'trail-runner-x1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @ApiPropertyOptional({ example: 'Lightweight trail running shoes.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @ApiPropertyOptional({ example: 129.99 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({ example: 159.99 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  comparePrice?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 'https://example.com/images/trail-x1.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'clx0000000001' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Brand id; null removes the brand' })
  @IsOptional()
  @IsString()
  brandId?: string | null;
}
