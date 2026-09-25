import { body, query } from 'express-validator';

/** MOVED VERBATIM from `routes/appointments.js` route middleware arrays. */
export const listValidation = [
  query('filter').optional().isIn(['all', 'today', 'upcoming', 'past']),
];

export const calendarSlotsValidation = [
  query('start').isISO8601(),
  query('end').isISO8601(),
];

export const createValidation = [
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/),
  body('start').matches(/^\d{2}:\d{2}$/),
  body('guest_name').trim().isLength({ min: 1, max: 255 }),
  body('guest_email').isEmail(),
  body('guest_phone').optional().isLength({ max: 50 }),
  body('notes').optional().isLength({ max: 500 }),
  body('service_ids').optional().isArray(),
  body('service_ids.*').optional().isInt({ min: 1 }),
];

export const rescheduleValidation = [
  body('starts_at').isISO8601(),
  body('ends_at').isISO8601(),
];
