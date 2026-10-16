import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { BD_MOBILE_REGEX, normalizeBdPhone } from '../../orders/dto/address-fields.js';

/** Profile edit: every field optional; an empty phone clears it. */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Rahim Uddin' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({ example: '01712345678', nullable: true, description: 'Empty string or null clears it' })
  @Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;
    const v = normalizeBdPhone(value.trim());
    return v === '' ? null : v;
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @Matches(BD_MOBILE_REGEX, { message: 'Enter a valid Bangladeshi mobile number (01XXXXXXXXX)' })
  phone?: string | null;
}
