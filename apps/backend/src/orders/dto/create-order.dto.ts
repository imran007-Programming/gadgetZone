import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  IsBdPhone,
  IsLocationName,
  IsOptionalLocationName,
  IsOptionalPostalCode,
  IsPersonName,
  IsStreetAddress,
} from './address-fields.js';

export class ShippingAddressDto {
  @ApiProperty({ example: 'Aarav Sharma' })
  @IsPersonName()
  name: string;

  @ApiProperty({ example: '01712345678' })
  @IsBdPhone()
  phone: string;

  @ApiProperty({ example: 'House 12, Road 5, Dhanmondi' })
  @IsStreetAddress()
  street: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsLocationName()
  district: string;

  @ApiProperty({ example: 'Dhaka South City Corporation', description: 'Upazila or thana' })
  @IsLocationName()
  upazila: string;

  @ApiPropertyOptional({ example: 'Dhanmondi', description: 'Union, pourashava or city area' })
  @IsOptionalLocationName()
  union?: string;

  @ApiPropertyOptional({ example: '1205' })
  @IsOptionalPostalCode()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Bangladesh', default: 'Bangladesh' })
  @IsOptional()
  @IsIn(['Bangladesh'], { message: 'We only deliver within Bangladesh' })
  country?: string;
}

export class CreateOrderDto {
  @ApiProperty({ type: ShippingAddressDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @ApiPropertyOptional({ example: "EID15" })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
