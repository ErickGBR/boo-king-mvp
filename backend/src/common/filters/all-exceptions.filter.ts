import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { ApiError } from '../errors/api-error';

/** Nest router "not found" responses look like `Cannot GET /api/x`. */
const ROUTER_NOT_FOUND = /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /;

/**
 * AllExceptionsFilter — byte-for-byte replica of the terminal error middleware
 * of the original Express entry (`src/index.js`, lines 84-89):
 *
 *   console.error(err);
 *   if (res.headersSent) return next(err);
 *   const status = err.status || 500;
 *   res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
 *
 * Mapping rules:
 *  - `ApiError` → the pre-built body VERBATIM (it models an explicit
 *    `res.status(s).json(body)` call, which in Express bypassed the error
 *    middleware — e.g. `500 {error:'Could not generate Google auth URL'}`).
 *    These are not logged, exactly like the original explicit responses, and
 *    their body survives the 5xx genericization below.
 *  - Any other `HttpException` (Nest/framework internals, e.g. body-parser
 *    malformed JSON) → `{ error: <message> }`, matching the errors that did
 *    reach the Express middleware (`err.status` + `err.message`); 5xx are
 *    genericized so internal detail is never leaked (C1 rule).
 *  - Unknown `/api/*` routes: Express served its default HTML 404 (which never
 *    reached the error middleware and was not logged); Nest raises a router
 *    NotFoundException. Per the Stage-2 PM decision we ACCEPT Nest's JSON here
 *    and document the difference (docs/migration/stage2-nestjs-design.md §8.3).
 *  - Non-framework errors that still carry an HTTP status (`err.status`, the
 *    convention used by `http-errors`/`raw-body`, e.g. the body-parser
 *    `PayloadTooLargeError` at 413 `request entity too large`) → honour that
 *    status and expose `err.message` for 4xx, exactly like `err.status || 500`
 *    in the Express middleware. Nest does not wrap this specific error in an
 *    `HttpException`, so without this branch it would degrade to 500.
 *  - Everything else (plain `Error`, Prisma failures, …) → 500
 *    `{ error: 'Internal server error' }` and is logged server-side.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    if (res.headersSent) return;

    let status = 500;
    let body: Record<string, unknown> = { error: 'Internal server error' };
    let shouldLog = false;

    if (exception instanceof ApiError) {
      status = exception.getStatus();
      body = exception.getResponse() as Record<string, unknown>;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string' ? response : (response as any)?.message;

      if (status === 404 && typeof message === 'string' && ROUTER_NOT_FOUND.test(message)) {
        // Accepted deviation (documented): Nest's JSON for unknown routes.
        // Express never logged these, so neither do we.
        body =
          typeof response === 'object'
            ? (response as Record<string, unknown>)
            : { statusCode: 404, message, error: 'Not Found' };
      } else {
        shouldLog = true;
        body = { error: message };
      }
    } else {
      // Mirrors the Express middleware fallback `const status = err.status || 500`:
      // framework-agnostic errors that carry a `status`/`statusCode` (http-errors
      // convention, e.g. body-parser's 413 PayloadTooLargeError) keep that status
      // and expose their message for 4xx; anything else stays a generic 500.
      const explicitStatus =
        typeof (exception as any)?.status === 'number'
          ? ((exception as any).status as number)
          : typeof (exception as any)?.statusCode === 'number'
            ? ((exception as any).statusCode as number)
            : undefined;

      shouldLog = true;

      if (explicitStatus !== undefined) {
        status = explicitStatus;
        body = { error: (exception as any)?.message };
      }
    }

    if (status >= 500 && !(exception instanceof ApiError)) {
      // 5xx responses must never leak internals (C1). The ONE exception is an
      // ApiError: it models an explicit `res.status(s).json(body)` that in the
      // Express code bypassed the terminal error middleware, so its hand-written
      // body (e.g. `{error:'Could not generate Google auth URL'}`) is emitted
      // verbatim even at 5xx. Unexpected errors (Nest HttpExceptions, Prisma
      // failures, plain Errors) keep the generic body.
      body = { error: 'Internal server error' };
    }

    if (shouldLog) {
      // Same side effect as the Express middleware: unexpected errors are
      // logged server-side, never exposed in the response.
      // eslint-disable-next-line no-console
      console.error(exception);
    }

    res.status(status).json(body);
  }
}
