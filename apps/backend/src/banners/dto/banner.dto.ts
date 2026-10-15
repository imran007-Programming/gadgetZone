import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBannerDto {
  @ApiProperty({ example: 'Sony XM5 launch', description: 'Internal name; also the image alt text' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title: string;

  @ApiPropertyOptional({ description: 'Product opened when the banner is clicked' })
  @IsOptional()
  @IsString()
  productId?: string | null;

  @ApiPropertyOptional({
    example: '/products?category=audio',
    description: 'Used only when no product is linked',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\/|https?:\/\/)/, { message: 'Link must start with "/" or http(s)://' })
  @MaxLength(300)
  ctaHref?: string | null;

  @ApiProperty({ description: 'Image URL from POST /admin/banners/upload' })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiPropertyOptional({ description: 'Cloudinary public_id from the upload' })
  @IsOptional()
  @IsString()
  publicId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

export class ReorderBannersDto {
  @ApiProperty({ type: [String], description: 'Every banner id in the new display order' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids: string[];
}
