import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../errors/api-error';

/**
 * Extracts the business id for the current request from the
 * X-Current-Business-Id header, or (fallback) from `businessId` in the body
 * or query string, depending on how the route transports it.
 * MOVED VERBATIM from `src/middleware/ownership.js`.
 */
function getBusinessIdFromRequest(req: any): number | null {
  const sources = [
    req.headers['x-current-business-id'],
    req.body?.businessId,
    req.query?.businessId,
  ];
  for (const raw of sources) {
    if (raw === undefined || raw === null || raw === '') continue;
    const id = Number(raw);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

/**
 * BusinessOwnershipGuard — 1:1 replica of `verifyBusinessOwnership`
 * (src/middleware/ownership.js).
 *
 * CRITICAL (C3) — verifies that the business referenced by the request belongs
 * to the authenticated user. Without this check any authenticated user could
 * read or mutate businesses, staff and appointments of OTHER users (IDOR).
 *
 * On success sets `req.business` (the owned Business row). Responds 404 (never
 * 403, to avoid leaking whether the business exists) and 400 when no business
 * id was provided.
 */
@Injectable()
export class BusinessOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!req.user) {
      throw new ApiError(401, { error: 'Unauthorized' });
    }
    const businessId = getBusinessIdFromRequest(req);
    if (!businessId) {
      throw new ApiError(400, { error: 'Select a business' });
    }
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, userId: req.user.id },
    });
    if (!business) {
      throw new ApiError(404, { error: 'Business not found' });
    }
    req.business = business;
    return true;
  }
}
