import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { WishlistService } from './wishlist.service.js';

/**
 * Wishlist routes are authenticated but have no @Roles() metadata: per the
 * RolesGuard contract, any authenticated user (ADMIN or CUSTOMER) passes.
 * Only the customer's own wishlist is ever touched (@CurrentUser userId).
 */
@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current wishlist with product details' })
  getWishlist(@CurrentUser() user: RequestUser) {
    return this.wishlistService.getWishlist(user.userId);
  }

  @Post(':productId')
  @ApiOperation({ summary: 'Toggle a product in the wishlist' })
  toggle(
    @CurrentUser() user: RequestUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.toggle(user.userId, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('productId') productId: string,
  ) {
    return this.wishlistService.remove(user.userId, productId);
  }
}
