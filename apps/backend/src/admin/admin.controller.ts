import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { ProductImportService } from './product-import.service.js';
import { MAX_IMAGE_BYTES, imageOnlyFilter } from '../common/upload.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { SetStockDto } from './dto/set-stock.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { QueryOrdersDto } from './dto/query-orders.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';

/**
 * Phase 5: back-office APIs. Every route here is ADMIN-only — the global
 * JwtAuthGuard authenticates, and @Roles('ADMIN') on the class is enforced
 * by the global RolesGuard.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly productImport: ProductImportService,
  ) {}

  // ------------------------------------------------------------- products

  @Post('products')
  @ApiOperation({ summary: 'Create a product (admin)' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminService.createProduct(dto);
  }

  /**
   * Bulk import: one CSV ("csv" field) plus any number of image files
   * ("images" field). CSV rows reference images by file name or by URL.
   */
  @Post('products/bulk')
  @ApiOperation({ summary: 'Bulk-create products from a CSV and image files (admin)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'csv', maxCount: 1 },
        { name: 'images', maxCount: 1000 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES } },
    ),
  )
  bulkImport(
    @UploadedFiles()
    files: { csv?: Express.Multer.File[]; images?: Express.Multer.File[] },
  ) {
    return this.productImport.importCsv(files.csv?.[0], files.images ?? []);
  }

  @Post('products/:id/images')
  @ApiOperation({ summary: 'Upload images to a product gallery (admin)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: imageOnlyFilter,
    }),
  )
  addProductImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.adminService.addProductImages(id, files);
  }

  @Delete('products/:id/images/:imageId')
  @ApiOperation({ summary: 'Remove one image from a product gallery (admin)' })
  deleteProductImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.adminService.deleteProductImage(id, imageId);
  }

  @Get('products')
  @ApiOperation({ summary: 'List all products including inactive ones (admin)' })
  listProducts() {
    return this.adminService.listProducts();
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get one product including inactive ones (admin)' })
  getProduct(@Param('id') id: string) {
    return this.adminService.getProduct(id);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Partially update a product (admin)' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.adminService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({
    summary: 'Soft-delete a product (sets isActive=false; idempotent)',
  })
  softDeleteProduct(@Param('id') id: string) {
    return this.adminService.softDeleteProduct(id);
  }

  @Patch('products/:id/stock')
  @ApiOperation({ summary: 'Set a product stock level (admin)' })
  setStock(@Param('id') id: string, @Body() dto: SetStockDto) {
    return this.adminService.setProductStock(id, dto.stock);
  }

  // ------------------------------------------------------------ categories

  @Post('categories')
  @ApiOperation({ summary: 'Create a category (admin)' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category (admin)' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({
    summary: 'Delete a category (admin) — 409 if products reference it',
  })
  deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // ---------------------------------------------------------------- orders

  @Get('orders')
  @ApiOperation({ summary: 'List all orders, newest first (admin)' })
  listOrders(@Query() query: QueryOrdersDto) {
    return this.adminService.listOrders(query.status);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Change an order status (admin, validated)' })
  updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(id, dto.status);
  }

  // ----------------------------------------------------------------- users

  @Get('users')
  @ApiOperation({ summary: 'List all users (safe fields only, admin)' })
  listUsers(@Query() query: QueryUsersDto) {
    return this.adminService.listUsers(query.role);
  }

  @Get('users/:id/orders')
  @ApiOperation({ summary: "List a user's orders with items (admin)" })
  getUserOrders(@Param('id') id: string) {
    return this.adminService.getUserOrders(id);
  }

  @Patch('users/:id/disable')
  @ApiOperation({ summary: 'Disable a user account (admin)' })
  disableUser(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.adminService.disableUser(id, user.userId);
  }

  @Patch('users/:id/enable')
  @ApiOperation({ summary: 'Re-enable a user account (admin)' })
  enableUser(@Param('id') id: string) {
    return this.adminService.enableUser(id);
  }

  // ----------------------------------------------------------------- stats

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard stats (admin)' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('revenue-by-category')
  @ApiOperation({ summary: 'Revenue grouped by product category (admin)' })
  getRevenueByCategory() {
    return this.adminService.getRevenueByCategory();
  }

  @Get('orders-by-hour')
  @ApiOperation({ summary: 'Today orders bucketed by hour (admin)' })
  getOrdersByHour() {
    return this.adminService.getOrdersByHour();
  }

  @Get('revenue-trend')
  @ApiOperation({ summary: 'Monthly revenue for the last 12 months (admin)' })
  getRevenueTrend() {
    return this.adminService.getRevenueTrend();
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top selling products by quantity (admin)' })
  getTopProducts() {
    return this.adminService.getTopProducts();
  }
}
