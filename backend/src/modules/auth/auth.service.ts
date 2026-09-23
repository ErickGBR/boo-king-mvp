import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleService } from '../google/google.service';
import { MailerService } from '../mailer/mailer.service';
import { ApiError } from '../../common/errors/api-error';
import { signToken } from '../../common/auth/token.util';
import { generateSecurePassword } from '../../common/auth/password.util';

/**
 * AuthService — handler bodies MOVED VERBATIM from `routes/auth.js`.
 * The only transform is I/O: `res.status(s).json(b)` → `return b` (+
 * `@HttpCode(s)`) or `throw new ApiError(s, b)`.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleService,
    private readonly mailer: MailerService,
  ) {}

  async register(body: any): Promise<any> {
    const { name, email, password } = body;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(422, { error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    let user: any;
    try {
      user = await this.prisma.user.create({
        data: { name, email, password: hashed },
        select: { id: true, name: true, email: true, role: true },
      });
    } catch (err: any) {
      // D17.3 — two concurrent registrations for the same e-mail both pass the
      // findUnique check (bcrypt deliberately widens that window). The DB
      // `email @unique` still rejects the second INSERT, but it used to surface
      // as a raw 500. Map P2002 to this endpoint's EXISTING duplicate contract:
      // 422 { error: 'Email already registered' } (same body as the fast path).
      if (err?.code === 'P2002') {
        throw new ApiError(422, { error: 'Email already registered' });
      }
      throw err;
    }
    const token = signToken({ userId: user.id });
    return { user, token };
  }

  async login(body: any): Promise<any> {
    const { email, password } = body;
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      throw new ApiError(401, { error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new ApiError(401, { error: 'Invalid credentials' });
    }
    const token = signToken({ userId: user.id });
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
      token,
    };
  }

  async updateMe(userId: number, body: any): Promise<any> {
    const { name, password } = body;

    if (name === undefined && password === undefined) {
      throw new ApiError(400, { error: 'Nothing to update' });
    }

    const data: any = {};
    if (name !== undefined) {
      data.name = name;
    }
    if (password !== undefined) {
      data.password = await bcrypt.hash(password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, avatar: true },
    });

    return { user };
  }

  /**
   * Forgot-password flow: generate a random password, store its bcrypt hash and
   * e-mail the clear-text value to the registered address.
   *
   * Security notes:
   *  - The response is ALWAYS `200 { ok: true }`, whether or not the e-mail is
   *    registered, so the endpoint cannot be used to enumerate accounts.
   *  - One bcrypt hash is computed on BOTH branches (the generated password is
   *    discarded when the user does not exist) so the response time does not
   *    reveal whether the account exists either.
   *  - The clear-text password never leaves this method except through the
   *    mailer call: it is not persisted, logged or returned.
   *  - The e-mail is fire-and-forget (project convention, see BookingService):
   *    a failing SMTP server must not keep the API request open nor change the
   *    generic response.
   *
   * Sessions stay JWT-based and untouched: previously issued tokens remain
   * valid, exactly as before this endpoint existed.
   */
  async forgotPassword(body: any): Promise<any> {
    const { email } = body || {};

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // Always generate + hash, even for an unknown e-mail (timing equalization).
    const newPassword = generateSecurePassword();
    const hashed = await bcrypt.hash(newPassword, 10);

    if (user) {
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { password: hashed },
        });
      } catch (err: any) {
        // P2025 = row deleted between the lookup and the update: nothing to
        // reset, but the response must stay generic (no account enumeration).
        if (err?.code !== 'P2025') throw err;
        return { ok: true };
      }

      // `sendPasswordResetEmail` swallows + logs transport errors itself.
      this.mailer.sendPasswordResetEmail(user.email, newPassword).catch(console.error);
    }

    return { ok: true };
  }

  /**
   * Google sign-in via the OAuth2 auth-code flow (Option A of the review, C1).
   * The browser only sends an authorization code (redirect_uri=postmessage per
   * Google Identity Services); the backend exchanges it for an ID token,
   * verifies it with a strict audience bound to GOOGLE_CLIENT_ID and requires
   * email_verified === true.
   */
  async googleLogin(body: any): Promise<any> {
    const { code } = body || {};
    if (!code || typeof code !== 'string') {
      throw new ApiError(422, { error: 'Google authorization code required' });
    }
    try {
      const tokens = await this.google.exchangeCode(code, 'postmessage');
      if (!tokens?.id_token) {
        throw new ApiError(401, { error: 'Invalid Google code' });
      }
      const payload = await this.google.verifyGoogleToken(tokens.id_token);
      if (!payload?.email || payload.email_verified !== true) {
        throw new ApiError(401, { error: 'Invalid Google token' });
      }
      const email = payload.email;
      let user: any = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          googleId: true,
        },
      });
      if (user) {
        if (!user.googleId) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { googleId: payload.sub, avatar: payload.picture || user.avatar },
            select: { id: true, name: true, email: true, role: true, avatar: true },
          });
        }
      } else {
        user = await this.prisma.user.create({
          data: {
            name: payload.name || email.split('@')[0],
            email,
            googleId: payload.sub,
            avatar: payload.picture || null,
            password: null,
          },
          select: { id: true, name: true, email: true, role: true, avatar: true },
        });
      }
      const authToken = signToken({ userId: user.id });
      return { user, token: authToken };
    } catch (err) {
      // Fast-path 401s above are ApiError and must keep their exact body; only
      // unexpected failures are mapped to the generic 401 (as in Express).
      if (err instanceof ApiError) throw err;
      console.error('Google auth error:', err);
      throw new ApiError(401, { error: 'Google authentication failed' });
    }
  }
}
