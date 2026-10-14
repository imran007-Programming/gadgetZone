import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create an order from the current cart' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my orders, newest first' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.ordersService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my orders' })
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.ordersService.findOne(user.userId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a PENDING order (restores stock)' })
  cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.ordersService.cancel(user.userId, id);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Mock-pay a PENDING order' })
  pay(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.ordersService.pay(user.userId, id);
  }
}
