import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Sony' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: 'sony' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Use lowercase letters, numbers and hyphens' })
  @MaxLength(60)
  slug: string;

  @ApiPropertyOptional({ example: 'Japanese electronics — audio, gaming and cameras.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Logo URL from POST /admin/brands/upload; null removes it' })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoPublicId?: string | null;

  @ApiPropertyOptional({ description: 'Cover image URL from POST /admin/brands/upload; null removes it' })
  @IsOptional()
  @IsString()
  bannerUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bannerPublicId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
