import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { IsBdPhone, IsLocationName, IsPersonName, IsStreetAddress, trimToUndefined } from './address-fields.js';

/** Billing contact, sent only when the order ships to a different address. */
export class BillingAddressDto {
  @ApiProperty({ example: 'Rahim Uddin' })
  @IsPersonName()
  name: string;

  @ApiProperty({ example: '01712345678' })
  @IsBdPhone()
  phone: string;

  @ApiProperty({ example: 'House 12, Road 5, Sakaripara' })
  @IsStreetAddress()
  street: string;

  @ApiProperty({ example: 'Lakshmipur' })
  @IsLocationName()
  district: string;
}

/**
 * Fields both checkout payloads (logged-in and guest) accept on top of the
 * address: order notes, the bKash / Nagad Transaction ID for an advance
 * delivery charge, and a separate billing contact.
 */
export class CheckoutExtrasDto {
  @ApiPropertyOptional({ example: 'Please call before delivery' })
  @trimToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: '9A7B6C5D4E', description: 'bKash / Nagad Transaction ID' })
  @trimToUndefined()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{6,20}$/, { message: 'Transaction ID must be 6–20 letters or digits' })
  transactionId?: string;

  @ApiPropertyOptional({ type: BillingAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress?: BillingAddressDto;
}
