import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleService } from './google.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiError } from '../../common/errors/api-error';
import { createOAuthState, verifyOAuthState } from '../../common/auth/token.util';

/**
 * GoogleController — handler bodies MOVED VERBATIM from `routes/google.js`.
 * `FRONTEND_URL` is read at call time (same default), the OAuth state helpers
 * live in `common/auth/token.util.ts` (same JWT_SECRET, HS256, 10m, purpose).
 */
@Controller('google')
export class GoogleController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly google: GoogleService,
  ) {}

  private get frontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  /** #35 GET /api/google/auth → 200 {url} */
  @Get('auth')
  @UseGuards(JwtAuthGuard)
  authUrl(@CurrentUser() user: any) {
    try {
      return { url: this.google.getAuthUrl({ state: createOAuthState(user.id) }) };
    } catch (err) {
      console.error('Error generating Google auth URL:', err);
      throw new ApiError(500, { error: 'Could not generate Google auth URL' });
    }
  }

  /**
   * #36 GET /api/google/callback — PUBLIC endpoint invoked by Google's redirect.
   * Raw Express response preserved (passthrough disabled) to keep the exact 302.
   */
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const redirectTo = (flag: string) =>
      res.redirect(`${this.frontendUrl}/dashboard/calendar?google=${flag}`);
    try {
      const code = (req.query as any).code;
      const state = (req.query as any).state;
      if (!code || typeof code !== 'string' || !state) {
        return redirectTo('error');
      }
      const decoded = verifyOAuthState(state);
      if (!decoded) {
        return redirectTo('error');
      }
      const user = await this.prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        return redirectTo('error');
      }
      const tokens = await this.google.exchangeCode(code);
      // M1 — the authorized Google account must belong to the same user. The ID
      // token is MANDATORY: without it (or when it fails verification, or when
      // it carries a different email) the association is refused with
      // ?google=error and the refresh token is NEVER persisted.
      if (!tokens?.id_token) {
        return redirectTo('error');
      }
      const payload = await this.google.verifyGoogleToken(tokens.id_token);
      if (!payload?.email || !user.email) {
        return redirectTo('error');
      }
      if (payload.email.toLowerCase() !== user.email.toLowerCase()) {
        return redirectTo('error');
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleRefreshToken: tokens.refresh_token || user.googleRefreshToken,
          googleCalendarSync: true,
        },
      });
      return redirectTo('connected');
    } catch (err) {
      console.error('Google callback error:', err);
      return redirectTo('error');
    }
  }

  /** #37 GET /api/google/status → 200 {connected, syncEnabled} */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@CurrentUser() user: any) {
    try {
      const row = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { googleRefreshToken: true, googleCalendarSync: true },
      });
      return {
        connected: !!row?.googleRefreshToken,
        syncEnabled: row?.googleCalendarSync || false,
      };
    } catch (err) {
      console.error('Google status error:', err);
      throw new ApiError(500, { error: 'Could not fetch Google status' });
    }
  }

  /** #38 POST /api/google/sync → 200 {syncEnabled, synced} */
  @Post('sync')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async sync(@CurrentUser() user: any, @Body() body: any) {
    try {
      const enabled = !!body?.enabled;
      // Validate BEFORE mutating: enabling sync without a connected Google
      // account returns 400 WITHOUT persisting googleCalendarSync=true.
      const row = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { googleRefreshToken: true },
      });
      if (enabled && !row?.googleRefreshToken) {
        throw new ApiError(400, { error: 'Connect Google Calendar first' });
      }
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleCalendarSync: enabled },
        select: { googleCalendarSync: true },
      });
      if (!updated.googleCalendarSync) {
        return { syncEnabled: false, synced: 0 };
      }
      const synced = await this.google.syncAllUpcomingAppointments(user.id);
      return { syncEnabled: true, synced };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      console.error('Google sync error:', err);
      throw new ApiError(500, { error: 'Could not update Google sync' });
    }
  }

  /** #39 DELETE /api/google/disconnect → 200 {ok:true} */
  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: any) {
    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { googleRefreshToken: null, googleCalendarSync: false },
      });
      return { ok: true };
    } catch (err) {
      console.error('Google disconnect error:', err);
      throw new ApiError(500, { error: 'Could not disconnect Google' });
    }
  }
}
