import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

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

  @ApiPropertyOptional({ example: 60, description: 'Delivery charge inside Dhaka (BDT)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  deliveryFeeInsideDhaka?: number;

  @ApiPropertyOptional({ example: 99, description: 'Delivery charge outside Dhaka (BDT)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  deliveryFeeOutsideDhaka?: number;

  @ApiPropertyOptional({ example: true, description: 'Outside Dhaka: delivery charge paid in advance by bKash / Nagad' })
  @IsOptional()
  @IsBoolean()
  advanceOutsideDhaka?: boolean;

  @ApiPropertyOptional({ example: '01XXXXXXXXX', description: 'bKash number for advance payments (empty = none)' })
  @IsOptional()
  @IsString()
  @Matches(/^(01[3-9]\d{8})?$/, { message: 'bKash number must be 01XXXXXXXXX' })
  bkashNumber?: string;

  @ApiPropertyOptional({ example: '01XXXXXXXXX', description: 'Nagad number for advance payments (empty = none)' })
  @IsOptional()
  @IsString()
  @Matches(/^(01[3-9]\d{8})?$/, { message: 'Nagad number must be 01XXXXXXXXX' })
  nagadNumber?: string;
}
