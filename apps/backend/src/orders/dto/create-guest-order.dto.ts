import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  IsBdPhone,
  IsLocationName,
  IsOptionalLocationName,
  IsOptionalPostalCode,
  IsPersonName,
  IsStreetAddress,
  trimToUndefined,
} from './address-fields.js';

export class GuestOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateGuestOrderDto {
  @ApiProperty({ example: 'Rahim Uddin' })
  @IsPersonName()
  name: string;

  @ApiProperty({ example: '01712345678' })
  @IsBdPhone()
  phone: string;

  @ApiPropertyOptional({ example: 'rahim@example.com' })
  @trimToUndefined()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'House 12, Road 5, Dhanmondi', description: 'House / road / village / area' })
  @IsStreetAddress()
  address: string;

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

  @ApiProperty({ type: [GuestOrderItemDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Cart is empty' })
  @ValidateNested({ each: true })
  @Type(() => GuestOrderItemDto)
  items: GuestOrderItemDto[];

  @ApiPropertyOptional({ example: "EID15" })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
