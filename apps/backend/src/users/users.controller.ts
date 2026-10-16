import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { SafeUserDto, toSafeUser } from '../auth/dto/safe-user.dto.js';
import type { RequestUser } from '../auth/strategies/jwt.strategy.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update my profile (name, mobile number)' })
  async updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto): Promise<SafeUserDto> {
    const updated = await this.usersService.updateProfile(user.userId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
    });
    return toSafeUser(updated);
  }
}
