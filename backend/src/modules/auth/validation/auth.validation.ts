import { body } from 'express-validator';

/** MOVED VERBATIM from `routes/auth.js` route middleware arrays. */
export const registerValidation = [
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
];

export const updateMeValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 255 }),
  body('password').optional().isLength({ min: 8, max: 128 }),
];

/**
 * Forgot-password only needs a syntactically valid e-mail. `normalizeEmail()`
 * mutates `req.body` in place (same as login/register) so the handler looks the
 * user up with the same normalized form that was stored at registration.
 */
export const forgotPasswordValidation = [body('email').isEmail().normalizeEmail()];
