import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Injects `req.user` (set by JwtAuthGuard / OptionalAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

/** Injects `req.business` (set by BusinessOwnershipGuard). */
export const CurrentBusiness = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().business,
);
