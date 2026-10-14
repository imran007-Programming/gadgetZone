import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Phase 2: extracts the authenticated user (JWT payload) from the request.
 * Usage: handler(@CurrentUser() user: JwtPayload)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
