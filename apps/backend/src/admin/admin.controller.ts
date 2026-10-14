import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';
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
  constructor(private readonly adminService: AdminService) {}

  // ------------------------------------------------------------- products

  @Post('products')
  @ApiOperation({ summary: 'Create a product (admin)' })
  createProduct(@Body() dto: CreateProductDto) {
    return this.adminService.createProduct(dto);
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
}
