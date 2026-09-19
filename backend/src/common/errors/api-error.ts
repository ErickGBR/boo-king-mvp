import { HttpException } from '@nestjs/common';

/**
 * ApiError — an error carrying a pre-built response body, mirroring the
 * `res.status(s).json(body)` calls of the original Express handlers.
 *
 * The body is stored through `HttpException` itself (`getResponse()`), so
 * `AllExceptionsFilter` can serialize it verbatim for ANY status — including
 * explicit 5xx bodies such as `{ error: 'Could not generate Google auth URL' }`,
 * which in Express bypassed the terminal error middleware.
 */
export class ApiError extends HttpException {
  constructor(status: number, body: Record<string, unknown>) {
    super(body, status);
  }
}
