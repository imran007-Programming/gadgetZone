import { Module } from '@nestjs/common';
import { AdminCouponsController, CouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

@Module({
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
