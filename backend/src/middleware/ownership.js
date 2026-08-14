import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Extracts the business id for the current request from the
 * X-Current-Business-Id header, or (fallback) from `businessId` in the body
 * or query string, depending on how the route transports it.
 * @param {import('express').Request} req - express request
 * @returns {number|null} numeric business id, or null when absent/invalid
 */
function getBusinessIdFromRequest(req) {
  const sources = [req.headers['x-current-business-id'], req.body?.businessId, req.query?.businessId];
  for (const raw of sources) {
    if (raw === undefined || raw === null || raw === '') continue;
    const id = Number(raw);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

/**
 * CRITICAL (C3) — verifies that the business referenced by the request
 * (header X-Current-Business-Id, or businessId in body/query) belongs to the
 * authenticated user. Without this check any authenticated user could read or
 * mutate businesses, staff and appointments of OTHER users (IDOR).
 *
 * On success, sets `req.business` (the owned Business row) and calls next().
 * Responds 404 (never 403, to avoid leaking whether the business exists) when
 * the business does not exist or is not owned by the user, and 400 when no
 * business id was provided.
 */
export async function verifyBusinessOwnership(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const businessId = getBusinessIdFromRequest(req);
    if (!businessId) {
      return res.status(400).json({ error: 'Select a business' });
    }
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: req.user.id },
    });
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    req.business = business;
    next();
  } catch (err) {
    next(err);
  }
}
