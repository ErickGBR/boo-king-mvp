import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiError } from '../errors/api-error';
import { UserNotFoundError } from '../auth/user-not-found.error';

/**
 * JwtAuthGuard — Passport's `AuthGuard('jwt')` with the 401 bodies of the
 * original `authMiddleware` (src/middleware/auth.js), which Passport's defaults
 * (`{statusCode,message,error}`) would otherwise replace:
 *
 *   no token                  → 401 { error: 'Unauthorized' }
 *   malformed / expired token → 401 { error: 'Invalid token' }
 *   token ok, user deleted    → 401 { error: 'User not found' }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any): any {
    if (err) {
      if (err instanceof UserNotFoundError) {
        throw new ApiError(401, { error: 'User not found' });
      }
      throw new ApiError(401, { error: 'Invalid token' });
    }
    if (!user) {
      const missing = info?.message === 'No auth token';
      throw new ApiError(401, { error: missing ? 'Unauthorized' : 'Invalid token' });
    }
    return user;
  }
}
