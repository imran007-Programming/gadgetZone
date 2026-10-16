import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Storefront settings (top bar text, support phone)' })
  get() {
    return this.settings.get();
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/settings')
@Roles('ADMIN')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Patch()
  @ApiOperation({ summary: 'Update storefront settings (admin)' })
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
