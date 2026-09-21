import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../errors/api-error';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard — replicate of `requireRole(...roles)` (src/middleware/auth.js):
 *   401 { error: 'Unauthorized' } when there is no authenticated user;
 *   403 { error: 'Forbidden' }    when the user's role is not allowed.
 *
 * On the staff routes this guard runs BEFORE BusinessOwnershipGuard, matching
 * the Express middleware order (`requireRole` then `verifyBusinessOwnership`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    if (!req.user) {
      throw new ApiError(401, { error: 'Unauthorized' });
    }
    if (!required.includes(req.user.role)) {
      throw new ApiError(403, { error: 'Forbidden' });
    }
    return true;
  }
}
