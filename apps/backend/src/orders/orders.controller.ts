import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateGuestOrderDto } from './dto/create-guest-order.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrdersService } from './orders.service.js';

const IDEMPOTENCY_HEADER = {
  name: 'Idempotency-Key',
  required: false,
  description:
    'Random token per checkout attempt (e.g. a UUID). Resending it returns the order already placed instead of a duplicate.',
};

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // At most 3 orders a minute from one IP: stops scripts from flooding orders to lock up stock
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an order from the current cart' })
  @ApiHeader(IDEMPOTENCY_HEADER)
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.create(user.userId, dto, idempotencyKey);
  }

  @Post('guest')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest checkout (no login, COD only)' })
  @ApiHeader(IDEMPOTENCY_HEADER)
  createGuest(@Body() dto: CreateGuestOrderDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.ordersService.createGuest(dto, idempotencyKey);
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
