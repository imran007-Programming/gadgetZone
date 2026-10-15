import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CreateReviewDto, ModerateReviewDto, QueryReviewsDto } from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('product/:productId')
  @Public()
  @ApiOperation({ summary: 'Approved reviews and rating summary for a product' })
  forProduct(@Param('productId') productId: string) {
    return this.reviews.forProduct(productId);
  }

  @Get('eligibility/:productId')
  @ApiOperation({ summary: 'Can the current customer review this product?' })
  eligibility(@CurrentUser() user: RequestUser, @Param('productId') productId: string) {
    return this.reviews.eligibility(user.userId, productId);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a review (verified, delivered purchase only)' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.userId, dto);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/reviews')
@Roles('ADMIN')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews, optionally by status (admin)' })
  list(@Query() query: QueryReviewsDto) {
    return this.reviews.list(query.status);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Approve/reject a review and/or reply (admin)' })
  moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.moderate(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a review (admin)' })
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}
