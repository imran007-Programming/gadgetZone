import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { ProductImportService } from './product-import.service.js';

@Module({
  controllers: [AdminController],
  providers: [AdminService, ProductImportService],
  exports: [AdminService],
})
export class AdminModule {}
