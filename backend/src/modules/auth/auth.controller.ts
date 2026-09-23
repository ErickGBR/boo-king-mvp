import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ValidationGuard } from '../../common/guards/validation.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  forgotPasswordValidation,
  loginValidation,
  registerValidation,
  updateMeValidation,
} from './validation/auth.validation';

/** `routes/auth.js` → AuthController (global limiter `/api/auth` 20/15min). */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** #1 POST /api/auth/register → 201 */
  @Post('register')
  @UseGuards(new ValidationGuard(registerValidation))
  register(@Body() body: any) {
    return this.auth.register(body);
  }

  /** #2 POST /api/auth/login → 200 */
  @Post('login')
  @HttpCode(200)
  @UseGuards(new ValidationGuard(loginValidation))
  login(@Body() body: any) {
    return this.auth.login(body);
  }

  /** #3 POST /api/auth/logout → 200 {ok:true} + clearCookie('token') */
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    return { ok: true };
  }

  /** #4 GET /api/auth/me → 200 {user} */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return { user };
  }

  /** #5 PUT /api/auth/me → 200 {user} */
  @Put('me')
  @UseGuards(JwtAuthGuard, new ValidationGuard(updateMeValidation))
  updateMe(@CurrentUser() user: any, @Body() body: any) {
    return this.auth.updateMe(user.id, body);
  }

  /** #6 POST /api/auth/google → 200 {user, token} */
  @Post('google')
  @HttpCode(200)
  googleLogin(@Body() body: any) {
    return this.auth.googleLogin(body);
  }

  /**
   * #7 POST /api/auth/forgot-password → 200 {ok:true}
   *
   * Always the same generic body (registered e-mail or not), so the endpoint
   * cannot be used to enumerate accounts. The clear-text password is only ever
   * delivered by e-mail; it is never part of this response.
   */
  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(new ValidationGuard(forgotPasswordValidation))
  forgotPassword(@Body() body: any) {
    return this.auth.forgotPassword(body);
  }
}
