import { body, param } from 'express-validator';

/** MOVED VERBATIM from `routes/staff.js` route middleware arrays. */
export const createStaffValidation = [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['staff', 'admin', 'owner']),
];

export const removeStaffValidation = [param('id').isInt()];
