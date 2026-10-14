/**
 * Payment provider contract. Registered via DI as an abstract-class token:
 * swap the registered implementation (e.g. to a Stripe adapter) without
 * touching OrdersService.
 */
export interface PaymentResult {
  success: boolean;
  transactionId: string;
}

export abstract class PaymentService {
  abstract charge(orderId: string, amount: number): Promise<PaymentResult>;
}
