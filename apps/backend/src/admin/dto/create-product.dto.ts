import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'Trail Runner X1' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'trail-runner-x1' })
  @IsString()
  @MinLength(1)
  slug: string;

  @ApiProperty({ example: 'Lightweight trail running shoes.' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiProperty({ example: 129.99 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiPropertyOptional({ example: 159.99 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  comparePrice?: number;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiProperty({ example: 'https://example.com/images/trail-x1.jpg' })
  @IsUrl()
  imageUrl: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: 'clx0000000001' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;
}
