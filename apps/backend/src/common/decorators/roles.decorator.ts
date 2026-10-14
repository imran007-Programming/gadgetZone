import { SetMetadata } from '@nestjs/common';

export type Role = 'ADMIN' | 'CUSTOMER';

/** Phase 2: declares the roles allowed on a route, enforced by RolesGuard. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
