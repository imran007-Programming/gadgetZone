import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/** Partial update — every field optional. */
export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Running' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'running' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @ApiPropertyOptional({ example: 'Shoes and gear for runners.' })
  @IsOptional()
  @IsString()
  description?: string;
}
