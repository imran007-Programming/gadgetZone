import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { envValidationSchema } from './config/env.validation.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ProductsModule } from './products/products.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CartModule } from './cart/cart.module.js';
import { WishlistModule } from './wishlist/wishlist.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { AdminModule } from './admin/admin.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { BannersModule } from './banners/banners.module.js';
import { BrandsModule } from './brands/brands.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const { error, value } = envValidationSchema.validate(config, {
          abortEarly: false,
          allowUnknown: true,
        });
        if (error) {
          throw new Error(`Config validation error: ${error.message}`);
        }
        return value;
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    PrismaModule,
    CloudinaryModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    CartModule,
    WishlistModule,
    OrdersModule,
    AdminModule,
    CouponsModule,
    ReviewsModule,
    ReturnsModule,
    BannersModule,
    BrandsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard execution order follows provider order: auth first, then roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
