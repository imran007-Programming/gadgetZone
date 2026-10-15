import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    street: '12 Main Street',
    city: 'Dhaka',
    postalCode: '1000',
    country: 'Bangladesh',
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

    // stock decremented once per line item.
    expect(tx.product.update).toHaveBeenCalledTimes(2);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_alpha' },
      data: { stock: { decrement: 2 } },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_beta' },
      data: { stock: { decrement: 3 } },
    });

    // cart cleared for this user.
    expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
    });
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
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
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
