import { body, param } from 'express-validator';

/** MOVED VERBATIM from `routes/booking.js` reserve middleware array. */
export const reserveValidation = [
  param('slug').exists(),
  body('starts_at')
    .isISO8601()
    .custom((s) => {
      if (new Date(s) <= new Date()) throw new Error('starts_at must be in the future');
      return true;
    }),
  body('ends_at')
    .isISO8601()
    .custom((end, { req }) => {
      if (new Date(end) <= new Date(req.body.starts_at))
        throw new Error('ends_at must be after starts_at');
      return true;
    }),
  body('guest_name').trim().isLength({ min: 1, max: 255 }),
  body('guest_email').isEmail(),
  body('guest_phone').optional().isLength({ max: 50 }),
  body('notify_by_email').optional().isBoolean(),
  body('notes').optional().isLength({ max: 500 }),
  body('service_ids').optional().isArray(),
  body('service_ids.*').optional().isInt({ min: 1 }),
];
