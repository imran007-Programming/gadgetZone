import { Injectable } from '@nestjs/common';
import { PaymentResult, PaymentService } from './payment.service.js';

/**
 * Mock gateway for demo/dev: always approves after a short simulated
 * round-trip delay. To go live with Stripe, implement PaymentService with a
 * Stripe PaymentIntent confirm flow and register it in place of this class
 * in OrdersModule (same DI token).
 */
@Injectable()
export class MockPaymentService extends PaymentService {
  async charge(orderId: string, amount: number): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      success: true,
      transactionId: `mock_${orderId}_${Date.now()}`,
    };
  }
}
