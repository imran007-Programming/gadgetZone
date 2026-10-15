import { Module } from '@nestjs/common';
import { AdminBannersController, BannersController } from './banners.controller.js';
import { BannersService } from './banners.service.js';

@Module({
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService],
})
export class BannersModule {}
