import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { extractToken } from '../auth/token.util';
import { UserNotFoundError } from '../auth/user-not-found.error';

/**
 * JWT strategy — replicate of `authMiddleware` (src/middleware/auth.js):
 *  - token source: `Authorization: Bearer <t>` first, cookie `token` fallback
 *    (custom extractor, byte-identical to the Express expression);
 *  - HS256 only;
 *  - loads the user with the exact same projection
 *    `{ id, name, email, role, avatar }` and exposes it as `req.user`.
 *
 * Failure granularity (401 `Unauthorized` / `Invalid token` / `User not found`)
 * is emitted by JwtAuthGuard.handleRequest, not by Passport's defaults.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: (req: any) => extractToken(req),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: any): Promise<any> {
    if (!payload?.userId) {
      // Express: `if (!decoded?.userId) → 401 {error:'Invalid token'}`.
      throw new Error('Invalid token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, role: true, avatar: true },
    });
    if (!user) {
      throw new UserNotFoundError();
    }
    return user;
  }
}
