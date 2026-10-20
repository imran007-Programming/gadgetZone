import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { OrdersService } from './orders.service.js';
import type { PaymentService } from './payment/payment.service.js';
import { CouponsService } from '../coupons/coupons.service.js';

const dec = (n: number | string): Prisma.Decimal => new Prisma.Decimal(n);

interface MockProduct {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number;
  isActive: boolean;
}

interface MockCartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  product: MockProduct | null;
}

function makeProduct(overrides: Partial<MockProduct> = {}): MockProduct {
  return {
    id: 'prod_alpha',
    name: 'Alpha Tee',
    price: dec('25.50'),
    stock: 10,
    isActive: true,
    ...overrides,
  };
}

function makeCartItem(
  product: MockProduct | null,
  quantity: number,
  productId = 'prod_alpha',
): MockCartItem {
  return {
    id: `ci_${productId}_${quantity}`,
    userId: 'user_1',
    productId,
    quantity,
    product,
  };
}

/** Builds a tx-scoped prisma mock; the caller sets per-test implementations. */
function makeTx() {
  return {
    cartItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    order: {
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      update: vi.fn().mockResolvedValue({}),
      // Atomic stock reservation; count 0 = the stock condition failed (lost a race)
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
    // null = no saved settings yet, so the schema defaults apply (60 / 99, no advance)
    siteSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
}

type Tx = ReturnType<typeof makeTx>;

function makePrisma(tx: Tx) {
  return {
    $transaction: vi.fn(
      async (cb: (tx: Tx) => Promise<unknown>) => cb(tx),
    ),
    order: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makePayment(overrides: Partial<PaymentService> = {}) {
  return {
    charge: vi.fn(async () => ({
      success: true,
      transactionId: 'mock_txn_1',
    })),
    ...overrides,
  } as unknown as PaymentService;
}

/** An order.create payload shaped the way the service builds it. */
function makeCreatedOrder(
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    product: MockProduct;
  }>,
  total: Prisma.Decimal,
  status: OrderStatus = OrderStatus.PENDING,
) {
  return {
    id: 'order_1',
    userId: 'user_1',
    status,
    totalAmount: total,
    discountAmount: dec(0),
    couponId: null,
    couponCode: null,
    paymentMethod: 'cod',
    shippingFee: dec(0),
    shippingZone: null,
    transactionId: null,
    notes: null,
    billingAddress: null,
    returnRequests: [],
    shippingAddress: { name: 'Ada' },
    createdAt: new Date(),
    items: items.map((item, i) => ({
      id: `oi_${i}`,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.id,
        price: item.product.price,
        imageUrl: 'img',
      },
    })),
  };
}

const SHIPPING = {
  shippingAddress: {
    name: 'Ada',
    phone: '01712345678',
    street: 'House 12, Road 5',
    district: 'Dhaka',
    upazila: 'Dhaka South City Corporation',
    union: 'Dhanmondi',
    postalCode: '1205',
  },
};

describe('OrdersService.create', () => {
  let tx: Tx;
  let prisma: ReturnType<typeof makePrisma>;
  let payment: PaymentService;
  let service: OrdersService;

  beforeEach(() => {
    tx = makeTx();
    prisma = makePrisma(tx);
    payment = makePayment();
    service = new OrdersService(prisma as never, payment, new CouponsService(prisma as never));
  });

  it('creates the order with unit-price snapshots, decrements stock and clears the cart', async () => {
    const alpha = makeProduct();
    const beta = makeProduct({
      id: 'prod_beta',
      name: 'Beta Cap',
      price: dec('10.00'),
      stock: 5,
    });
    tx.cartItem.findMany.mockResolvedValue([
      makeCartItem(alpha, 2),
      makeCartItem(beta, 3, 'prod_beta'),
    ]);
    tx.order.create.mockImplementation(async () => {
      return makeCreatedOrder(
        [
          {
            productId: 'prod_alpha',
            quantity: 2,
            unitPrice: dec('25.50'),
            product: alpha,
          },
          {
            productId: 'prod_beta',
            quantity: 3,
            unitPrice: dec('10.00'),
            product: beta,
          },
        ],
        dec('81.00'),
      );
    });

    const result = await service.create('user_1', SHIPPING);

    expect(result.status).toBe(OrderStatus.PENDING);
    expect(result.totalAmount).toBe(81);
    expect(result.items).toHaveLength(2);
    // unitPrice is a snapshot of the product price at order time.
    expect(result.items[0].unitPrice).toBe(25.5);
    expect(result.items[1].unitPrice).toBe(10);

    // order.create wrote the nested items with the right snapshots.
    expect(tx.order.create).toHaveBeenCalledTimes(1);
    const createArgs = tx.order.create.mock.calls[0][0] as {
      data: {
        userId: string;
        status: OrderStatus;
        items: { create: Array<Record<string, unknown>> };
      };
    };
    expect(createArgs.data.userId).toBe('user_1');
    expect(createArgs.data.status).toBe(OrderStatus.PENDING);
    expect(createArgs.data.items.create).toHaveLength(2);
    expect(createArgs.data.items.create[0]).toMatchObject({
      productId: 'prod_alpha',
      quantity: 2,
    });
    expect(
      (createArgs.data.items.create[0].unitPrice as Prisma.Decimal).toNumber(),
    ).toBe(25.5);

    // stock taken once per line item, only where enough is left (atomic check + decrement).
    expect(tx.product.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod_alpha', isActive: true, stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod_beta', isActive: true, stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    expect(tx.product.update).not.toHaveBeenCalled();

    // cart cleared for this user.
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
    });
  });

  it('stores the canonical BD location and division on the order', async () => {
    const alpha = makeProduct();
    tx.cartItem.findMany.mockResolvedValue([makeCartItem(alpha, 1)]);
    tx.order.create.mockResolvedValue(
      makeCreatedOrder(
        [{ productId: 'prod_alpha', quantity: 1, unitPrice: dec('25.50'), product: alpha }],
        dec('25.50'),
      ),
    );

    await service.create('user_1', {
      shippingAddress: {
        ...SHIPPING.shippingAddress,
        district: 'lakshmipur',
        upazila: 'lakshmipur sadar',
        union: 'lakshmipur pourasabha',
        postalCode: undefined,
      },
    });

    const data = tx.order.create.mock.calls[0][0].data as {
      shippingAddress: Record<string, unknown>;
    };
    expect(data.shippingAddress).toMatchObject({
      district: 'Lakshmipur',
      upazila: 'Lakshmipur Sadar',
      union: 'Lakshmipur Pourasabha',
      division: 'Chattagram',
      city: 'Lakshmipur',
      postalCode: '',
      country: 'Bangladesh',
      phone: '01712345678',
    });
  });

  it('rejects an upazila that is not in the chosen district', async () => {
    await expect(
      service.create('user_1', {
        shippingAddress: { ...SHIPPING.shippingAddress, district: 'Tangail', upazila: 'Savar' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the cart is empty', async () => {
    tx.cartItem.findMany.mockResolvedValue([]);

    await expect(service.create('user_1', SHIPPING)).rejects.toThrow(
      expect.objectContaining({
        name: 'BadRequestException',
        message: 'Cart is empty',
      }),
    );
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects when any item has insufficient stock, naming the product', async () => {
    const scarce = makeProduct({
      id: 'prod_beta',
      name: 'Beta Cap',
      stock: 2,
    });
    tx.cartItem.findMany.mockResolvedValue([
      makeCartItem(makeProduct(), 1),
      makeCartItem(scarce, 5, 'prod_beta'),
    ]);

    await expect(service.create('user_1', SHIPPING)).rejects.toThrow(
      'Insufficient stock for "Beta Cap"',
    );
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects when another checkout takes the last unit first (stock race)', async () => {
    // The pre-check still sees 1 in stock, but by the time this order reserves it,
    // a concurrent order has taken it: the guarded UPDATE matches no row.
    const last = makeProduct({ stock: 1 });
    tx.cartItem.findMany.mockResolvedValue([makeCartItem(last, 1)]);
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    tx.product.findUnique.mockResolvedValue({ name: 'Alpha Tee', stock: 0, isActive: true });

    await expect(service.create('user_1', SHIPPING)).rejects.toThrow(
      'Insufficient stock for "Alpha Tee" (available: 0, requested: 1)',
    );
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it('reserves stock in product id order so concurrent carts cannot deadlock', async () => {
    const alpha = makeProduct();
    const beta = makeProduct({ id: 'prod_beta', name: 'Beta Cap' });
    // Cart lists beta first; reservation must still go alpha, then beta
    tx.cartItem.findMany.mockResolvedValue([
      makeCartItem(beta, 1, 'prod_beta'),
      makeCartItem(alpha, 1),
    ]);
    tx.order.create.mockResolvedValue(
      makeCreatedOrder(
        [
          { productId: 'prod_beta', quantity: 1, unitPrice: beta.price, product: beta },
          { productId: 'prod_alpha', quantity: 1, unitPrice: alpha.price, product: alpha },
        ],
        dec('51.00'),
      ),
    );

    await service.create('user_1', SHIPPING);

    const ids = tx.product.updateMany.mock.calls.map(
      (call) => (call[0] as { where: { id: string } }).where.id,
    );
    expect(ids).toEqual(['prod_alpha', 'prod_beta']);
  });

  it('rejects when a product is inactive', async () => {
    const retired = makeProduct({ name: 'Retired Tee', isActive: false });
    tx.cartItem.findMany.mockResolvedValue([makeCartItem(retired, 1)]);

    await expect(service.create('user_1', SHIPPING)).rejects.toThrow(
      'Product "Retired Tee" is no longer available',
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects when a product in the cart no longer exists', async () => {
    tx.cartItem.findMany.mockResolvedValue([
      makeCartItem(null, 1, 'prod_gone'),
    ]);

    await expect(service.create('user_1', SHIPPING)).rejects.toThrow(
      /no longer available/,
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});

describe('OrdersService.createGuest — stock', () => {
  let tx: Tx;
  let service: OrdersService;

  const GUEST = {
    name: 'Ada',
    phone: '01712345678',
    address: 'House 12, Road 5',
    district: 'Dhaka',
    upazila: 'Dhaka South City Corporation',
    union: 'Dhanmondi',
    postalCode: '1205',
  };

  beforeEach(() => {
    tx = makeTx();
    const prisma = makePrisma(tx);
    service = new OrdersService(prisma as never, makePayment(), new CouponsService(prisma as never));
  });

  it('reserves stock atomically before creating the order', async () => {
    const alpha = makeProduct();
    tx.product.findUnique.mockResolvedValue(alpha);
    tx.order.create.mockResolvedValue(
      makeCreatedOrder(
        [{ productId: 'prod_alpha', quantity: 2, unitPrice: alpha.price, product: alpha }],
        dec('51.00'),
      ),
    );

    await service.createGuest({ ...GUEST, items: [{ productId: 'prod_alpha', quantity: 2 }] } as never);

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod_alpha', isActive: true, stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.order.create).toHaveBeenCalledTimes(1);
  });

  it('rejects when another checkout takes the last unit first (stock race)', async () => {
    // Pre-check read: 1 left. Re-read after the guarded UPDATE fails: 0 left.
    tx.product.findUnique
      .mockResolvedValueOnce(makeProduct({ stock: 1 }))
      .mockResolvedValueOnce({ name: 'Alpha Tee', stock: 0, isActive: true });
    tx.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.createGuest({ ...GUEST, items: [{ productId: 'prod_alpha', quantity: 1 }] } as never),
    ).rejects.toThrow('Insufficient stock for "Alpha Tee" (available: 0, requested: 1)');
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});

describe('OrdersService.create — delivery charge', () => {
  let tx: Tx;
  let service: OrdersService;
  const OUTSIDE = {
    shippingAddress: {
      name: 'Ada',
      phone: '01712345678',
      street: 'House 12, Road 5',
      district: 'Lakshmipur',
      upazila: 'Lakshmipur Sadar',
    },
  };
  const createData = () =>
    (tx.order.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;

  beforeEach(() => {
    tx = makeTx();
    const prisma = makePrisma(tx);
    service = new OrdersService(prisma as never, makePayment(), new CouponsService(prisma as never));
    tx.cartItem.findMany.mockResolvedValue([makeCartItem(makeProduct(), 2)]);
    tx.order.create.mockResolvedValue(makeCreatedOrder([], dec('51.00')));
  });

  it('adds the inside-Dhaka charge to the total for Dhaka district', async () => {
    await service.create('user_1', SHIPPING);
    const data = createData();
    expect((data.totalAmount as Prisma.Decimal).toNumber()).toBe(51 + 60);
    expect((data.shippingFee as Prisma.Decimal).toNumber()).toBe(60);
    expect(data.shippingZone).toBe('inside_dhaka');
  });

  it('uses the admin-set outside-Dhaka charge and stores notes', async () => {
    tx.siteSetting.findUnique.mockResolvedValue({
      deliveryFeeInsideDhaka: 70,
      deliveryFeeOutsideDhaka: 130,
      advanceOutsideDhaka: false,
      bkashNumber: '',
      nagadNumber: '',
    });
    await service.create('user_1', { ...OUTSIDE, notes: 'Call first' });
    const data = createData();
    expect((data.totalAmount as Prisma.Decimal).toNumber()).toBe(51 + 130);
    expect(data.shippingZone).toBe('outside_dhaka');
    expect(data.notes).toBe('Call first');
  });

  it('requires a Transaction ID outside Dhaka when an advance number is set', async () => {
    tx.siteSetting.findUnique.mockResolvedValue({
      deliveryFeeInsideDhaka: 60,
      deliveryFeeOutsideDhaka: 99,
      advanceOutsideDhaka: true,
      bkashNumber: '01700000000',
      nagadNumber: '',
    });
    await expect(service.create('user_1', OUTSIDE)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();

    await service.create('user_1', { ...OUTSIDE, transactionId: 'ABC123XYZ' });
    expect(createData().transactionId).toBe('ABC123XYZ');
  });

  it('does not ask for a Transaction ID inside Dhaka', async () => {
    tx.siteSetting.findUnique.mockResolvedValue({
      deliveryFeeInsideDhaka: 60,
      deliveryFeeOutsideDhaka: 99,
      advanceOutsideDhaka: true,
      bkashNumber: '01700000000',
      nagadNumber: '',
    });
    await service.create('user_1', SHIPPING);
    expect(createData().transactionId).toBeNull();
  });
});

describe('OrdersService.cancel', () => {
  let tx: Tx;
  let prisma: ReturnType<typeof makePrisma>;
  let service: OrdersService;

  beforeEach(() => {
    tx = makeTx();
    prisma = makePrisma(tx);
    service = new OrdersService(prisma as never, makePayment(), new CouponsService(prisma as never));
  });

  it('cancels a PENDING order and restores stock inside the transaction', async () => {
    const alpha = makeProduct();
    prisma.order.findFirst.mockResolvedValue({
      id: 'order_1',
      status: OrderStatus.PENDING,
      items: [],
    });
    tx.order.update.mockResolvedValue(
      makeCreatedOrder(
        [
          {
            productId: 'prod_alpha',
            quantity: 2,
            unitPrice: dec('25.50'),
            product: alpha,
          },
        ],
        dec('51.00'),
        OrderStatus.CANCELLED,
      ),
    );

    const result = await service.cancel('user_1', 'order_1');

    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1' },
        data: { status: OrderStatus.CANCELLED },
      }),
    );
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_alpha' },
      data: { stock: { increment: 2 } },
    });
  });

  it('rejects an invalid status transition (PAID -> CANCELLED)', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order_1',
      status: OrderStatus.PAID,
      items: [],
    });

    await expect(service.cancel('user_1', 'order_1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 for an order that belongs to another user', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.cancel('user_1', 'order_999')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('OrdersService.pay', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let charge: ReturnType<typeof vi.fn>;
  let service: OrdersService;

  beforeEach(() => {
    const tx = makeTx();
    prisma = makePrisma(tx);
    charge = vi.fn(async () => ({
      success: true,
      transactionId: 'mock_txn_1',
    }));
    service = new OrdersService(
      prisma as never,
      { charge } as unknown as PaymentService,
      new CouponsService(prisma as never),
    );
  });

  it('charges and marks a PENDING order as PAID', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order_1',
      status: OrderStatus.PENDING,
      totalAmount: dec('51.00'),
    });
    prisma.order.update.mockResolvedValue(
      makeCreatedOrder(
        [
          {
            productId: 'prod_alpha',
            quantity: 2,
            unitPrice: dec('25.50'),
            product: makeProduct(),
          },
        ],
        dec('51.00'),
        OrderStatus.PAID,
      ),
    );

    const result = await service.pay('user_1', 'order_1');

    expect(charge).toHaveBeenCalledWith('order_1', 51);
    expect(result.status).toBe(OrderStatus.PAID);
  });

  it('rejects with 400 when the payment gateway fails', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order_1',
      status: OrderStatus.PENDING,
      totalAmount: dec('51.00'),
    });
    charge.mockResolvedValue({ success: false, transactionId: '' });

    await expect(service.pay('user_1', 'order_1')).rejects.toThrow(
      'Payment failed',
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('rejects paying an already-PAID order', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'order_1',
      status: OrderStatus.PAID,
      totalAmount: dec('51.00'),
    });

    await expect(service.pay('user_1', 'order_1')).rejects.toThrow(
      BadRequestException,
    );
    expect(charge).not.toHaveBeenCalled();
  });
});

describe('OrdersService.cancelStalePendingOrders', () => {
  const NOW = new Date('2026-10-20T12:00:00Z');

  function setup(stale: Array<{ id: string }>, stillPending = true) {
    const tx = {
      order: {
        updateMany: vi.fn().mockResolvedValue({ count: stillPending ? 1 : 0 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          couponId: 'coupon_1',
          items: [
            { productId: 'prod_alpha', quantity: 2 },
            { productId: 'prod_beta', quantity: 1 },
          ],
        }),
      },
      product: { update: vi.fn().mockResolvedValue({}) },
      coupon: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      order: { findMany: vi.fn().mockResolvedValue(stale) },
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    const service = new OrdersService(prisma as never, makePayment(), new CouponsService(prisma as never));
    return { tx, prisma, service };
  }

  it('only looks at PENDING orders past the cutoff that have no Transaction ID', async () => {
    const { prisma, service } = setup([]);

    await service.cancelStalePendingOrders(48, NOW);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: OrderStatus.PENDING,
          createdAt: { lt: new Date('2026-10-18T12:00:00Z') },
          OR: [{ transactionId: null }, { transactionId: '' }],
        },
      }),
    );
  });

  it('cancels a stale order and restores its stock and coupon use', async () => {
    const { tx, service } = setup([{ id: 'order_old' }]);

    const cancelled = await service.cancelStalePendingOrders(48, NOW);

    expect(cancelled).toBe(1);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order_old', status: OrderStatus.PENDING },
      data: { status: OrderStatus.CANCELLED },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_alpha' },
      data: { stock: { increment: 2 } },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_beta' },
      data: { stock: { increment: 1 } },
    });
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'coupon_1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  it('leaves an order alone if the admin confirmed it in the meantime', async () => {
    const { tx, service } = setup([{ id: 'order_old' }], false);

    const cancelled = await service.cancelStalePendingOrders(48, NOW);

    expect(cancelled).toBe(0);
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.coupon.updateMany).not.toHaveBeenCalled();
  });
});

describe('OrdersService — Idempotency-Key', () => {
  const KEY = '7f3a91bc-4e2d-4b8a-9c1e-2f6d8a0b5c3e';
  let tx: Tx;
  let prisma: ReturnType<typeof makePrisma> & { order: { findUnique: ReturnType<typeof vi.fn> } };
  let service: OrdersService;
  const alpha = makeProduct();
  const placed = () =>
    makeCreatedOrder(
      [{ productId: 'prod_alpha', quantity: 1, unitPrice: alpha.price, product: alpha }],
      dec('85.50'),
    );

  beforeEach(() => {
    tx = makeTx();
    const base = makePrisma(tx);
    prisma = { ...base, order: { ...base.order, findUnique: vi.fn().mockResolvedValue(null) } };
    service = new OrdersService(prisma as never, makePayment(), new CouponsService(prisma as never));
    tx.cartItem.findMany.mockResolvedValue([makeCartItem(alpha, 1)]);
    tx.order.create.mockResolvedValue(placed());
  });

  /** Places one order with KEY and returns the request hash it stored. */
  async function placeOnce(): Promise<string> {
    await service.create('user_1', SHIPPING, KEY);
    const data = tx.order.create.mock.calls[0][0].data as { idempotencyKey: string; idempotencyHash: string };
    return data.idempotencyHash;
  }

  it('stores the key and a hash of the request on a new order', async () => {
    const hash = await placeOnce();

    const data = tx.order.create.mock.calls[0][0].data as { idempotencyKey: string };
    expect(data.idempotencyKey).toBe(KEY);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the earlier order for a retry with the same key, without placing another', async () => {
    const hash = await placeOnce();
    prisma.order.findUnique.mockResolvedValue({ ...placed(), idempotencyHash: hash });

    const retry = await service.create('user_1', SHIPPING, KEY);

    expect(retry.id).toBe('order_1');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1); // only the first attempt
  });

  it('refuses a reused key whose request body changed', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...placed(), idempotencyHash: 'a-different-request' });

    await expect(service.create('user_1', SHIPPING, KEY)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses another account's key", async () => {
    const hash = await placeOnce();
    prisma.order.findUnique.mockResolvedValue({ ...placed(), userId: 'someone_else', idempotencyHash: hash });

    await expect(service.create('user_1', SHIPPING, KEY)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the winning order when a concurrent request with the same key commits first', async () => {
    let storedHash = '';
    tx.order.create.mockImplementation(async (args: { data: { idempotencyHash: string } }) => {
      storedHash = args.data.idempotencyHash;
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['idempotencyKey'] },
      });
    });
    prisma.order.findUnique
      .mockResolvedValueOnce(null) // not there yet when this request starts
      .mockImplementationOnce(async () => ({ ...placed(), idempotencyHash: storedHash }));

    const result = await service.create('user_1', SHIPPING, KEY);

    expect(result.id).toBe('order_1');
  });

  it('rejects a malformed key', async () => {
    await expect(service.create('user_1', SHIPPING, 'short')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('places orders as before when no key is sent', async () => {
    await service.create('user_1', SHIPPING);

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(tx.order.create.mock.calls[0][0].data).toMatchObject({ idempotencyKey: null, idempotencyHash: null });
  });
});
