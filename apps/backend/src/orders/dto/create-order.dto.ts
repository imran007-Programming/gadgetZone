import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ShippingAddressDto {
  @ApiProperty({ example: 'Aarav Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '12 Main Street' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: '1000' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiProperty({ example: 'Bangladesh' })
  @IsString()
  @IsNotEmpty()
  country: string;
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
