import { Module } from '@nestjs/common';
import { AdminReturnsController, ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';

@Module({
  controllers: [ReturnsController, AdminReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
