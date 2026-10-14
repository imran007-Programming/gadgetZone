import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CartService } from './cart.service.js';

const dec = (n: number | string): Prisma.Decimal => new Prisma.Decimal(n);

interface MockProduct {
  id: string;
  name: string;
  slug: string;
  price: Prisma.Decimal;
  imageUrl: string;
  stock: number;
  isActive: boolean;
}

function makeProduct(overrides: Partial<MockProduct> = {}): MockProduct {
  return {
    id: 'prod_alpha',
    name: 'Alpha Tee',
    slug: 'alpha-tee',
    price: dec('19.99'),
    imageUrl: 'img-alpha',
    stock: 10,
    isActive: true,
    ...overrides,
  };
}

function makePrisma() {
  return {
    product: { findUnique: vi.fn() },
    cartItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

type PrismaMock = ReturnType<typeof makePrisma>;

function makeService(prisma: PrismaMock) {
  return new CartService(prisma as never);
}

describe('CartService.addItem', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('rejects with 400 when the requested quantity exceeds stock', async () => {
    prisma.product.findUnique.mockResolvedValue(makeProduct({ stock: 2 }));
    prisma.cartItem.findUnique.mockResolvedValue(null);

    await expect(
      makeService(prisma).addItem('user_1', {
        productId: 'prod_alpha',
        quantity: 3,
      }),
    ).rejects.toThrow('Insufficient stock for "Alpha Tee"');

    expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
  });

  it('accounts for the quantity already in the cart against stock', async () => {
    prisma.product.findUnique.mockResolvedValue(makeProduct({ stock: 5 }));
    // 4 already in the cart + 2 requested = 6 > 5 in stock.
    prisma.cartItem.findUnique.mockResolvedValue({ quantity: 4 });

    await expect(
      makeService(prisma).addItem('user_1', {
        productId: 'prod_alpha',
        quantity: 2,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
  });

  it('throws 404 for a product that does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      makeService(prisma).addItem('user_1', {
        productId: 'prod_gone',
        quantity: 1,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
  });

  it('rejects an inactive product with 400', async () => {
    prisma.product.findUnique.mockResolvedValue(
      makeProduct({ isActive: false }),
    );

    await expect(
      makeService(prisma).addItem('user_1', {
        productId: 'prod_alpha',
        quantity: 1,
      }),
    ).rejects.toThrow('Product "Alpha Tee" is not available');

    expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
  });

  it('upserts the merged quantity and returns the cart with line totals', async () => {
    const product = makeProduct({ stock: 10 });
    prisma.product.findUnique.mockResolvedValue(product);
    prisma.cartItem.findUnique.mockResolvedValue({ quantity: 2 });
    prisma.cartItem.upsert.mockResolvedValue({});
    // getCart reads the merged cart: 2 existing + 3 added.
    prisma.cartItem.findMany.mockResolvedValue([
      { productId: 'prod_alpha', quantity: 5, product },
    ]);

    const cart = await makeService(prisma).addItem('user_1', {
      productId: 'prod_alpha',
      quantity: 3,
    });

    expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 'user_1', productId: 'prod_alpha' } },
      create: { userId: 'user_1', productId: 'prod_alpha', quantity: 3 },
      update: { quantity: 5 },
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe('prod_alpha');
    expect(cart.items[0].quantity).toBe(5);
    expect(cart.items[0].lineTotal).toBeCloseTo(99.95, 2);
    expect(cart.items[0].product.price).toBe(19.99);
    expect(cart.subtotal).toBeCloseTo(99.95, 2);
    expect(cart.itemCount).toBe(5);
  });
});

describe('CartService.updateItem', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('rejects with 400 when the new quantity exceeds stock', async () => {
    prisma.cartItem.findUnique.mockResolvedValue({
      quantity: 1,
      product: makeProduct({ stock: 2 }),
    });

    await expect(
      makeService(prisma).updateItem('user_1', 'prod_alpha', 5),
    ).rejects.toThrow('Insufficient stock for "Alpha Tee"');

    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it('throws 404 when the item is not in the cart', async () => {
    prisma.cartItem.findUnique.mockResolvedValue(null);

    await expect(
      makeService(prisma).updateItem('user_1', 'prod_alpha', 1),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it('updates the quantity and returns the cart with line totals', async () => {
    const product = makeProduct({ stock: 10 });
    prisma.cartItem.findUnique.mockResolvedValue({ quantity: 1, product });
    prisma.cartItem.update.mockResolvedValue({});
    prisma.cartItem.findMany.mockResolvedValue([
      { productId: 'prod_alpha', quantity: 4, product },
    ]);

    const cart = await makeService(prisma).updateItem(
      'user_1',
      'prod_alpha',
      4,
    );

    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 'user_1', productId: 'prod_alpha' } },
      data: { quantity: 4 },
    });
    expect(cart.items[0].lineTotal).toBeCloseTo(79.96, 2);
    expect(cart.subtotal).toBeCloseTo(79.96, 2);
    expect(cart.itemCount).toBe(4);
  });
});

describe('CartService.getCart', () => {
  it('returns line totals, subtotal and item count for multiple items', async () => {
    const prisma = makePrisma();
    const alpha = makeProduct();
    const beta = makeProduct({
      id: 'prod_beta',
      name: 'Beta Cap',
      slug: 'beta-cap',
      price: dec('10.00'),
    });
    prisma.cartItem.findMany.mockResolvedValue([
      { productId: 'prod_alpha', quantity: 2, product: alpha },
      { productId: 'prod_beta', quantity: 1, product: beta },
    ]);

    const cart = await makeService(prisma).getCart('user_1');

    expect(cart.items).toHaveLength(2);
    expect(cart.items[0].lineTotal).toBeCloseTo(39.98, 2);
    expect(cart.items[1].lineTotal).toBeCloseTo(10, 2);
    expect(cart.subtotal).toBeCloseTo(49.98, 2);
    expect(cart.itemCount).toBe(3);
  });
});
