import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Running' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'running' })
  @IsString()
  @MinLength(1)
  slug: string;

  @ApiPropertyOptional({ example: 'Shoes and gear for runners.' })
  @IsOptional()
  @IsString()
  description?: string;
}
