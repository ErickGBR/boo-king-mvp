import { body } from 'express-validator';

/** MOVED VERBATIM from `routes/services.js` route middleware arrays. */
export const createServiceValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required (1-100 chars)'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a number >= 0'),
  body('durationMinutes')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be an integer > 0'),
  body('active').optional().isBoolean(),
];

export const updateServiceValidation = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('price').optional().isFloat({ min: 0 }),
  body('durationMinutes').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('active').optional().isBoolean(),
];
