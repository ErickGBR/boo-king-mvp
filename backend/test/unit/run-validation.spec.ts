import { body, query } from 'express-validator';
import { runValidation } from '../../src/common/validation/run-validation';
import { ApiError } from '../../src/common/errors/api-error';

/**
 * Unit contract for the express-validator bridge (design doc §3.2 / §9.1
 * decision 1). The bridge must reproduce the Express behaviour byte-for-byte:
 * 422 `{ errors: [ { type, value, msg, path, location } ] }`, sanitizer
 * side-effects, and — critically — DECLARATION ORDER of the `errors` array.
 */
function makeReq(overrides: Record<string, any> = {}): any {
  return {
    body: {},
    query: {},
    params: {},
    cookies: {},
    headers: {},
    ...overrides,
  };
}

describe('runValidation (express-validator bridge)', () => {
  it('throws ApiError 422 with the { errors: [...] } array shape', async () => {
    const req = makeReq({ body: { email: 'nope', password: '123' } });

    const error = await runValidation(req, [
      body('email').isEmail(),
      body('password').isLength({ min: 8 }),
    ]).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.getStatus()).toBe(422);
    const payload: any = error.getResponse();
    expect(Object.keys(payload)).toEqual(['errors']);
    expect(payload.errors).toHaveLength(2);
    for (const item of payload.errors) {
      expect(item).toEqual(
        expect.objectContaining({
          type: expect.any(String),
          msg: expect.any(String),
          path: expect.any(String),
          location: 'body',
        }),
      );
      expect(item).toHaveProperty('value');
    }
  });

  it('preserves DECLARATION ORDER of the errors[] array (sequential chains)', async () => {
    const req = makeReq({ body: { zebra: '', alpha: 'x', middle: 'y' } });

    const error = await runValidation(req, [
      body('zebra').isLength({ min: 1 }),
      body('alpha').isInt(),
      body('middle').isInt(),
    ]).catch((e) => e);

    expect(error.getResponse().errors.map((e: any) => e.path)).toEqual([
      'zebra',
      'alpha',
      'middle',
    ]);
  });

  it('runs chains sequentially: a later chain observes an earlier sanitizer', async () => {
    const req = makeReq({ body: { name: '  hi  ' } });

    await runValidation(req, [
      body('name').trim(),
      // Only passes if trim() ran FIRST (sequential, not concurrent).
      body('name').matches(/^hi$/),
    ]);

    expect(req.body.name).toBe('hi');
  });

  it('applies msg overrides verbatim (golden string parity)', async () => {
    const req = makeReq({ body: { categoryId: '-1' } });

    const error = await runValidation(req, [
      body('categoryId').isInt({ gt: 0 }).withMessage('Invalid categoryId'),
    ]).catch((e) => e);

    expect(error.getResponse().errors[0].msg).toBe('Invalid categoryId');
  });

  it('honours the onError override (staff DELETE: 404 {error:"Not found"})', async () => {
    const req = makeReq({ params: { id: 'abc' } });

    const error = await runValidation(
      req,
      // `param` chains need the request `params`; express-validator pulls from req.params.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      [require('express-validator').param('id').isInt()],
      { status: 404, body: () => ({ error: 'Not found' }) },
    ).catch((e) => e);

    expect(error.getStatus()).toBe(404);
    expect(error.getResponse()).toEqual({ error: 'Not found' });
  });

  it('normalizeEmail sanitizes req.body in place (persisted value parity)', async () => {
    const req = makeReq({ body: { email: 'User.Name+tag@gmail.com' } });

    await runValidation(req, [body('email').isEmail().normalizeEmail()]);

    expect(req.body.email).toBe('username@gmail.com');
  });

  it('reports the correct location for query validators', async () => {
    const req = makeReq({ query: { filter: 'bogus' } });

    const error = await runValidation(req, [
      query('filter').isIn(['all', 'today', 'upcoming', 'past']),
    ]).catch((e) => e);

    const first = error.getResponse().errors[0];
    expect(first.location).toBe('query');
    expect(first.path).toBe('filter');
  });

  it('resolves without throwing when there are no errors', async () => {
    const req = makeReq({ body: { email: 'ok@example.com', password: 'password1' } });

    await expect(
      runValidation(req, [
        body('email').isEmail(),
        body('password').isLength({ min: 8 }),
      ]),
    ).resolves.toBeUndefined();
  });
});
