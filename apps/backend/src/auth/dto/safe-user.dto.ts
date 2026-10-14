import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import type { Role } from '../../common/decorators/roles.decorator.js';

/**
 * Public user shape — passwordHash / refreshTokenHash are never exposed.
 */
export class SafeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ['ADMIN', 'CUSTOMER'] })
  role: Role;

  @ApiProperty()
  createdAt: Date;
}

export function toSafeUser(user: User): SafeUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    createdAt: user.createdAt,
  };
}
