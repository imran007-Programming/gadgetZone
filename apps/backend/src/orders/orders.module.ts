import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { MockPaymentService } from './payment/mock-payment.service.js';
import { PaymentService } from './payment/payment.service.js';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    // Stripe plug-in point: replace MockPaymentService with a Stripe adapter
    // implementing the same PaymentService contract.
    { provide: PaymentService, useClass: MockPaymentService },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
