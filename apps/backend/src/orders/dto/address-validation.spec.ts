import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BD_DISTRICTS, resolveBdLocation } from '../../common/bd-locations.js';
import { CreateGuestOrderDto } from './create-guest-order.dto.js';
import { ShippingAddressDto } from './create-order.dto.js';

const VALID = {
  name: 'Priya Patel',
  phone: '01712345678',
  street: 'Sakaripara, 5 no ward',
  district: 'Lakshmipur',
  upazila: 'Lakshmipur Sadar',
  union: 'Lakshmipur Pourasabha',
};

async function errorsOf(cls: new () => object, plain: object) {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.map((e) => e.property);
}

describe('ShippingAddressDto', () => {
  it('accepts a complete Bangladeshi address', async () => {
    expect(await errorsOf(ShippingAddressDto, VALID)).toEqual([]);
  });

  it('normalises +88 / spaced mobile numbers', async () => {
    const dto = plainToInstance(ShippingAddressDto, { ...VALID, phone: '+88 017-1234-5678' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.phone).toBe('01712345678');
  });

  it.each(['0171234567', '01212345678', '1712345678', 'abc'])(
    'rejects invalid mobile number %s',
    async (phone) => {
      expect(await errorsOf(ShippingAddressDto, { ...VALID, phone })).toEqual(['phone']);
    },
  );

  it('requires district and upazila, and rejects blank ones', async () => {
    expect(
      await errorsOf(ShippingAddressDto, { ...VALID, district: ' ', upazila: undefined }),
    ).toEqual(['district', 'upazila']);
  });

  it('treats an empty union / postal code as not given, but checks a real one', async () => {
    expect(await errorsOf(ShippingAddressDto, { ...VALID, union: '', postalCode: '' })).toEqual([]);
    expect(await errorsOf(ShippingAddressDto, { ...VALID, postalCode: '37' })).toEqual(['postalCode']);
  });

  it('only delivers within Bangladesh', async () => {
    expect(await errorsOf(ShippingAddressDto, { ...VALID, country: 'India' })).toEqual(['country']);
  });
});

describe('CreateGuestOrderDto', () => {
  const guest = {
    ...VALID,
    address: VALID.street,
    email: '',
    items: [{ productId: 'p1', quantity: 1 }],
  };

  it('accepts a guest order with an empty optional email', async () => {
    expect(await errorsOf(CreateGuestOrderDto, guest)).toEqual([]);
  });

  it('rejects an empty cart and a too-short address', async () => {
    expect(await errorsOf(CreateGuestOrderDto, { ...guest, items: [], address: 'abc' })).toEqual([
      'address',
      'items',
    ]);
  });
});

describe('resolveBdLocation', () => {
  it('covers all 64 districts', () => {
    expect(BD_DISTRICTS).toHaveLength(64);
  });

  it('returns canonical names plus the division, case-insensitively', () => {
    expect(resolveBdLocation({ district: 'dhaka', upazila: 'savar' })).toEqual({
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Savar',
      union: undefined,
    });
  });

  it('cleans truncated city corporation names', () => {
    const dhaka = BD_DISTRICTS.find((d) => d.name === 'Dhaka')!;
    expect(dhaka.upazilas.map((u) => u.name)).toContain('Dhaka North City Corporation');
  });

  it('rejects an upazila from another district', () => {
    expect(() => resolveBdLocation({ district: 'Tangail', upazila: 'Savar' })).toThrow(
      /not an upazila\/thana of Tangail/,
    );
  });

  it('rejects a union from another upazila', () => {
    expect(() =>
      resolveBdLocation({ district: 'Dhaka', upazila: 'Savar', union: 'Lakshmipur Pourasabha' }),
    ).toThrow(/not a union\/area of Savar/);
  });
});
