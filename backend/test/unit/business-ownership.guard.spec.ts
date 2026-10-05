import { BusinessOwnershipGuard } from '../../src/common/guards/business-ownership.guard';

/**
 * Unit contract for the IDOR rule (design doc C3 / R6):
 *  - no authenticated user        → 401 {error:'Unauthorized'}
 *  - no business id in the request → 400 {error:'Select a business'}
 *  - business not owned by user    → 404 {error:'Business not found'} (never 403)
 *  - owned                         → true + `req.business` set
 * Id extraction order is fixed: header → body → query.
 */
function makeContext(req: any): any {
  return { switchToHttp: () => ({ getRequest: () => req }) };
}

describe('BusinessOwnershipGuard', () => {
  let prisma: any;
  let guard: BusinessOwnershipGuard;

  beforeEach(() => {
    prisma = { business: { findFirst: jest.fn() } };
    guard = new BusinessOwnershipGuard(prisma);
  });

  it('401 when there is no authenticated user', async () => {
    const req: any = { headers: {}, body: {}, query: {} };
    await expect(guard.canActivate(makeContext(req))).rejects.toMatchObject({
      status: 401,
    });
    await expect(guard.canActivate(makeContext(req))).rejects.toThrow();
  });

  it('400 "Select a business" when no valid business id is present', async () => {
    const req: any = { user: { id: 1 }, headers: {}, body: {}, query: {} };
    const error = await guard.canActivate(makeContext(req)).catch((e) => e);
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual({ error: 'Select a business' });
    expect(prisma.business.findFirst).not.toHaveBeenCalled();
  });

  it('ignores non-integer / non-positive ids (400)', async () => {
    const req: any = {
      user: { id: 1 },
      headers: { 'x-current-business-id': 'abc' },
      body: { businessId: 0 },
      query: { businessId: 'x' },
    };
    const error = await guard.canActivate(makeContext(req)).catch((e) => e);
    expect(error.getStatus()).toBe(400);
  });

  it('reads the id from X-Current-Business-Id first', async () => {
    const owned = { id: 7, userId: 1 };
    prisma.business.findFirst.mockResolvedValue(owned);
    const req: any = {
      user: { id: 1 },
      headers: { 'x-current-business-id': '7' },
      body: { businessId: 99 },
      query: { businessId: 88 },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(prisma.business.findFirst).toHaveBeenCalledWith({
      where: { id: 7, userId: 1 },
    });
    expect(req.business).toBe(owned);
  });

  it('falls back to body.businessId when the header is absent', async () => {
    prisma.business.findFirst.mockResolvedValue({ id: 12, userId: 1 });
    const req: any = {
      user: { id: 1 },
      headers: {},
      body: { businessId: 12 },
      query: {},
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(prisma.business.findFirst).toHaveBeenCalledWith({
      where: { id: 12, userId: 1 },
    });
  });

  it('falls back to query.businessId when header and body are absent', async () => {
    prisma.business.findFirst.mockResolvedValue({ id: 5, userId: 1 });
    const req: any = {
      user: { id: 1 },
      headers: {},
      body: {},
      query: { businessId: '5' },
    };

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(prisma.business.findFirst).toHaveBeenCalledWith({
      where: { id: 5, userId: 1 },
    });
  });

  it('404 (never 403) when the business belongs to another user', async () => {
    prisma.business.findFirst.mockResolvedValue(null);
    const req: any = {
      user: { id: 1 },
      headers: { 'x-current-business-id': '42' },
      body: {},
      query: {},
    };

    const error = await guard.canActivate(makeContext(req)).catch((e) => e);
    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({ error: 'Business not found' });
    expect(req.business).toBeUndefined();
  });
});
