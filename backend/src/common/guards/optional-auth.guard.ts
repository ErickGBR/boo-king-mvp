import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * OptionalAuthGuard — replicate of `optionalAuth` (src/middleware/auth.js):
 * a missing OR invalid token NEVER fails the request; the request continues
 * anonymously (`req.user` stays undefined). Used only by `GET /api/tickets/:id`.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any): any {
    // Never throw: unresolved/invalid token → continue as anonymous.
    return user || undefined;
  }
}
