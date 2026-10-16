import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** Partial update of the storefront settings — every field optional. */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  topbarEnabled?: boolean;

  @ApiPropertyOptional({ example: 'Corporate & Wholesale' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  topbarLeftTitle?: string;

  @ApiPropertyOptional({ example: 'Get Special Business Pricing' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  topbarLeftText?: string;

  @ApiPropertyOptional({ example: '/help', description: 'Site path (/help) or full https:// URL' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  topbarLeftLink?: string;

  @ApiPropertyOptional({ example: 'Use code EID10 for 10% off', description: 'Empty hides it' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  announcement?: string;

  @ApiPropertyOptional({ example: '/products?sort=price-asc' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  announcementLink?: string;

  @ApiPropertyOptional({ example: '+880 1521-334138' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  supportPhone?: string;
}
