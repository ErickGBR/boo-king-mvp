import { ValidationChain, validationResult } from 'express-validator';
import { ApiError } from '../errors/api-error';

export interface ValidationErrorOptions {
  /** HTTP status emitted when validation fails (default 422). */
  status: number;
  /** Body builder for the failure response (default `{ errors: [...] }`). */
  body: (errors: unknown[]) => Record<string, unknown>;
}

/**
 * Reusable bridge that runs an `express-validator` chain against the raw
 * Express request, exactly like the per-route middleware arrays of the original
 * code did. Kept VERBATIM: same status (422), same `{ errors: [ {type, value,
 * msg, path, location} ] }` array, same `msg` overrides, and the same
 * sanitizer side-effects (`trim()`, `normalizeEmail()` mutate `req.body` in
 * place, which is what the controllers then persist).
 *
 * The only callers that deviate from the 422 default are the staff DELETE route
 * (invalid id → 404 `{error:'Not found'}`).
 */
export async function runValidation(
  req: any,
  chains: ValidationChain[],
  onError?: ValidationErrorOptions,
): Promise<void> {
  // IMPORTANT: chains run SEQUENTIALLY, in declaration order. Express executed
  // them as an ordered middleware array, and `validationResult().array()` lists
  // errors in insertion order — running the chain concurrently would reorder
  // the `errors` array and change the response body.
  for (const chain of chains) {
    await chain.run(req);
  }
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array();
    if (onError) {
      throw new ApiError(onError.status, onError.body(errors));
    }
    throw new ApiError(422, { errors });
  }
}
