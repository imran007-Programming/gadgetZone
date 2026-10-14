import { SetMetadata } from '@nestjs/common';

/** Phase 2: marks a route as public so the global JwtAuthGuard skips it. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
