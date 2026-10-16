import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * Field rules shared by the logged-in (ShippingAddressDto) and guest
 * (CreateGuestOrderDto) checkout payloads. Location names are checked against
 * the real district/upazila/union tree in OrdersService (resolveBdLocation).
 */

/** 01XXXXXXXXX: 11 digits, operator prefix 013–019. */
export const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

/** Strips spaces/dashes and a +88 / 88 country prefix. */
export function normalizeBdPhone(value: string): string {
  return value.replace(/[\s-]/g, '').replace(/^\+?88(?=01)/, '');
}

const trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Trimmed; an empty string becomes undefined so @IsOptional skips it. */
const trimToUndefined = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  );

export const IsPersonName = () =>
  applyDecorators(trim(), IsString(), Length(2, 100));

export const IsBdPhone = () =>
  applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? normalizeBdPhone(value) : value,
    ),
    IsString(),
    Matches(BD_MOBILE_REGEX, {
      message: 'phone must be a valid Bangladeshi mobile number (01XXXXXXXXX)',
    }),
  );

export const IsStreetAddress = () =>
  applyDecorators(trim(), IsString(), Length(5, 250));

export const IsLocationName = () =>
  applyDecorators(trim(), IsString(), IsNotEmpty(), MaxLength(100));

export const IsOptionalLocationName = () =>
  applyDecorators(trimToUndefined(), IsOptional(), IsString(), MaxLength(100));

export const IsOptionalPostalCode = () =>
  applyDecorators(
    trimToUndefined(),
    IsOptional(),
    Matches(/^\d{4}$/, { message: 'postalCode must be 4 digits' }),
  );

export { trimToUndefined };
