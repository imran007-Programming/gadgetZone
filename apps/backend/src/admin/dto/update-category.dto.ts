import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength, ValidateIf } from 'class-validator';

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

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Parent (top-level) category id; null or omitted = top-level category',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ example: 0, description: 'Display order among siblings (lower first)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
