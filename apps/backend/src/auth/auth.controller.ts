import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SafeUserDto } from './dto/safe-user.dto.js';
import type { RequestUser } from './strategies/jwt.strategy.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiResponse({ status: 201, type: SafeUserDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto): Promise<SafeUserDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in, returns an access token + refresh cookie' })
  @ApiResponse({ status: 200, description: '{ accessToken }' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.authService.login(dto, res);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh-token cookie, returns a new access token',
  })
  @ApiResponse({ status: 200, description: '{ accessToken }' })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid or reused refresh token',
  })
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.authService.refresh(req, res);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the refresh token and clear its cookie' })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    return this.authService.logout(req, res);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  @ApiResponse({ status: 200, type: SafeUserDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  me(@CurrentUser() user: RequestUser): Promise<SafeUserDto> {
    return this.authService.me(user.userId);
  }
}

/**
 * Admin portal sign-in: only ADMIN accounts, with its own refresh cookie
 * (admin_refresh_token) so an admin session never mixes with a storefront one.
 * /auth/me is shared; it works with either access token.
 */
@ApiTags('auth')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin portal log in (admin accounts only)' })
  @ApiResponse({ status: 200, description: '{ accessToken }' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or not an admin account' })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.authService.login(dto, res, 'admin');
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the admin refresh cookie, returns a new access token' })
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    return this.authService.refresh(req, res, 'admin');
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the admin refresh token and clear its cookie' })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    return this.authService.logout(req, res, 'admin');
  }
}
