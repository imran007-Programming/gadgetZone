import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Minimal user data access for Phase 2 (auth).
 * Full admin user management arrives in Phase 5.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /** Profile edit by the user: name and mobile (null clears the mobile). */
  updateProfile(id: string, data: { name?: string; phone?: string | null }): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  /**
   * Stores the current refresh token hash. previousHash keeps the token it
   * replaced usable for a short grace period; passing null for both revokes
   * the session entirely.
   */
  updateRefreshTokenHash(
    id: string,
    refreshTokenHash: string | null,
    previousHash: string | null = null,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        refreshTokenHash,
        prevRefreshTokenHash: previousHash,
        refreshRotatedAt: refreshTokenHash ? new Date() : null,
      },
    });
  }

  /**
   * Replaces only the current refresh token hash, keeping the previous hash and
   * its rotation time, so a grace-period retry cannot extend the grace window.
   */
  replaceCurrentRefreshTokenHash(id: string, refreshTokenHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { refreshTokenHash },
    });
  }
}
