import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

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
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '01712345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'rahim@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'House 12, Road 5, Dhanmondi, Dhaka 1205' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ type: [GuestOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestOrderItemDto)
  items: GuestOrderItemDto[];

  @ApiPropertyOptional({ example: "EID15" })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
