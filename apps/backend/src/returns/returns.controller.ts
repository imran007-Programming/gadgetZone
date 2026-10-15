import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateReturnDto, QueryReturnsDto, UpdateReturnDto } from './dto/return.dto.js';
import { ReturnsService } from './returns.service.js';

@ApiTags('returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @ApiOperation({ summary: 'Request a return for one of my delivered orders' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReturnDto) {
    return this.returns.create(user.userId, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'My return requests' })
  mine(@CurrentUser() user: RequestUser) {
    return this.returns.mine(user.userId);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/returns')
@Roles('ADMIN')
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @ApiOperation({ summary: 'List return requests, optionally by status (admin)' })
  list(@Query() query: QueryReturnsDto) {
    return this.returns.list(query.status);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Approve, reject or refund a return (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateReturnDto) {
    return this.returns.update(id, dto);
  }
}
