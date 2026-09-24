import { body, param } from 'express-validator';

/** MOVED VERBATIM from `routes/businesses.js` route middleware arrays. */
export const createBusinessValidation = [
  body('name').trim().isLength({ min: 1, max: 255 }),
  // CRITICAL (QA): only positive integers are valid category ids.
  body('categoryId').isInt({ gt: 0 }).withMessage('Invalid categoryId'),
  body('durationMinutes').isIn([15, 30, 45, 60, 90, 120]),
  body('timezone').isLength({ min: 1, max: 50 }),
  body('locationType').isIn(['presencial', 'online']),
];

export const updateBusinessValidation = [
  param('id').isInt({ gt: 0 }),
  body('name').trim().isLength({ min: 1, max: 255 }),
  body('categoryId').isInt({ gt: 0 }).withMessage('Invalid categoryId'),
  body('durationMinutes').isIn([15, 30, 45, 60, 90, 120]),
  body('timezone').isLength({ min: 1, max: 50 }),
];
