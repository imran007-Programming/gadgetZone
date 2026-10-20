import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

const SETTINGS_ID = 'default';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The single settings row, created with the schema defaults on first read. */
  async get() {
    // Plain read first: an upsert runs as a transaction (several round trips) on every call
    const existing = await this.prisma.siteSetting.findUnique({ where: { id: SETTINGS_ID } });
    return (
      existing ??
      this.prisma.siteSetting.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID },
        update: {},
      })
    );
  }

  update(dto: UpdateSettingsDto) {
    const data = Object.fromEntries(
      Object.entries(dto).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    );
    return this.prisma.siteSetting.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });
  }
}
