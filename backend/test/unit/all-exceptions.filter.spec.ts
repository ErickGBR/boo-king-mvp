import { HttpException } from '@nestjs/common';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ApiError } from '../../src/common/errors/api-error';

/**
 * Unit contract for the terminal error filter (design doc §3.6). It replicates
 * the Express error middleware: `status = err.status || 500`, 5xx bodies never
 * leak internals, 4xx expose `err.message`, and explicit (ApiError) responses
 * are emitted verbatim — including 5xx ones that Express answered directly.
 */
function mockHost(headersSent = false) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res = { headersSent, status, json };
  const host: any = {
    switchToHttp: () => ({ getResponse: () => res }),
  };
  return { host, res, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('emits an ApiError body verbatim (422 {errors:[…]})', () => {
    const { host, status, json } = mockHost();
    const body = { errors: [{ path: 'email', msg: 'Invalid value' }] };

    filter.catch(new ApiError(422, body), host);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(body);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('emits a 4xx ApiError body verbatim WITHOUT logging', () => {
    const { host, status, json } = mockHost();
    filter.catch(new ApiError(400, { error: 'Select a business' }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Select a business' });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('emits an explicitly-built 5xx ApiError body verbatim (Google 500 parity)', () => {
    // Requested contract (api-error.ts / §9.4): an ApiError models an explicit
    // `res.status(500).json(body)` that in Express bypassed the error middleware
    // — so it must NOT be replaced by the generic 500 body.
    const { host, status, json } = mockHost();

    filter.catch(new ApiError(500, { error: 'Could not generate Google auth URL' }), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Could not generate Google auth URL' });
  });

  it('passes a Nest router 404 (Cannot GET …) through as JSON and does not log it', () => {
    const { host, status, json } = mockHost();

    filter.catch(
      new HttpException('Cannot GET /api/does-not-exist', 404),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Cannot GET /api/does-not-exist' }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps a generic HttpException to { error: message } and logs it', () => {
    const { host, status, json } = mockHost();

    filter.catch(new HttpException({ message: 'Bad thing' }, 400), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Bad thing' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('falls back to err.status for framework-agnostic errors (body-parser 413)', () => {
    const { host, status, json } = mockHost();
    const err: any = new Error('request entity too large');
    err.status = 413;

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({ error: 'request entity too large' });
  });

  it('falls back to err.statusCode when err.status is absent (400 parity)', () => {
    const { host, status, json } = mockHost();
    const err: any = new Error('malformed');
    err.statusCode = 400;

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'malformed' });
  });

  it('genericizes an unexpected Error to 500 and logs it', () => {
    const { host, status, json } = mockHost();

    filter.catch(new Error('database exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('genericizes an explicit 5xx statusCode (never leaks internals)', () => {
    const { host, status, json } = mockHost();
    const err: any = new Error('secret connection string');
    err.status = 503;

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('does nothing when headers were already sent', () => {
    const { host, status } = mockHost(true);

    filter.catch(new Error('too late'), host);

    expect(status).not.toHaveBeenCalled();
  });
});
