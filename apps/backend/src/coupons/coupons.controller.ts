import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CouponsService } from './coupons.service.js';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto.js';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('validate')
  @Public()
  @ApiOperation({ summary: 'Preview a coupon against a cart subtotal (checkout)' })
  validate(@Body() dto: ValidateCouponDto) {
    return this.coupons.validate(dto.code, dto.subtotal);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/coupons')
@Roles('ADMIN')
export class AdminCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'List coupons with usage (admin)' })
  list() {
    return this.coupons.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a coupon (admin)' })
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update or (de)activate a coupon (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an unused coupon, or deactivate a used one (admin)' })
  remove(@Param('id') id: string) {
    return this.coupons.remove(id);
  }
}
