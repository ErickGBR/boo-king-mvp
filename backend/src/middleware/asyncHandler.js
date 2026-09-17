/**
 * Async route handler wrapper (QA finding ALTO — server crashes on bad input).
 *
 * Express 4 does not catch rejected promises returned by async handlers: an
 * awaited rejection inside an async handler becomes an unhandled promise
 * rejection that, depending on runtime flags (e.g. --unhandled-rejections=throw),
 * kills the entire Node process. Every async route handler in the app MUST be
 * wrapped with this helper so rejections are forwarded to the Express error
 * middleware (next(err)) — the server responds 500 (or the error's own status)
 * and stays alive instead of crashing.
 *
 * @param {Function} fn - async handler: (req, res, next) => Promise
 * @returns {Function} Express middleware forwarding rejections to next(err)
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;
