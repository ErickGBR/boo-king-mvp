import nodemailer from 'nodemailer';
import { MailerService } from '../../src/modules/mailer/mailer.service';

/**
 * Unit contract for the mailer (design doc: "MOVED VERBATIM from
 * `src/services/email.js`"). The load-bearing behavioural promise is
 * FIRE-AND-FORGET: a dead SMTP server must never break the booking flow, so
 * both senders swallow transport errors and log them.
 *
 * `nodemailer` is mocked so no socket is ever opened: the suite must not depend
 * on SMTP_HOST/SMTP_PORT reachability (the previous coverage gap was exactly
 * this happy path, which could only be reached with a live transport).
 */
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

const createTransport = nodemailer.createTransport as unknown as jest.Mock;

const APPOINTMENT = {
  guestName: 'Ana Pérez',
  guestEmail: 'ana@example.com',
  startsAt: new Date('2030-03-14T15:00:00.000Z'),
  guestPhone: '5550-0000',
};

const BUSINESS = {
  name: 'Salón X',
  slug: 'salon-x',
  timezone: 'UTC',
  address: 'Calle 1',
};

describe('MailerService', () => {
  let service: MailerService;
  let sendMail: jest.Mock;
  let errorSpy: jest.SpyInstance;
  const env: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'FRONTEND_URL']) {
      env[key] = process.env[key];
    }
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    service = new MailerService();
    sendMail = jest.fn().mockResolvedValue({ messageId: 'mocked' });
    createTransport.mockReturnValue({ sendMail });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    createTransport.mockReset();
  });

  it('builds the transport from SMTP_* (including the secure flag) and uses SMTP_FROM', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '2525';
    process.env.SMTP_SECURE = 'true';
    process.env.SMTP_USER = 'user@example.com';
    process.env.SMTP_PASS = 'secret';
    process.env.SMTP_FROM = 'citas@example.com';

    await service.sendConfirmationEmail(APPOINTMENT, BUSINESS);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 2525,
      secure: true,
      auth: { user: 'user@example.com', pass: 'secret' },
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      from: 'citas@example.com',
      to: 'ana@example.com',
      subject: 'Cita confirmada en Salón X',
    });
  });

  it('falls back to the ethereal defaults when SMTP_* is empty (no throw)', async () => {
    delete process.env.SMTP_HOST;
    process.env.SMTP_PORT = '';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    delete process.env.SMTP_FROM;

    await service.sendRescheduleEmail(APPOINTMENT, BUSINESS);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: '', pass: '' },
    });
    expect(sendMail.mock.calls[0][0]).toMatchObject({ from: 'noreply@boo-king.com' });
  });

  it('renders the confirmation body with phone, address and the booking link', async () => {
    process.env.FRONTEND_URL = 'https://app.example.com';

    await service.sendConfirmationEmail(APPOINTMENT, BUSINESS);

    const html: string = sendMail.mock.calls[0][0].html;
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Salón X');
    expect(html).toContain('5550-0000');
    expect(html).toContain('Calle 1');
    expect(html).toContain('https://app.example.com/b/salon-x');
    // `es-SV` longer form: a rendered date, not the raw ISO string.
    expect(html).not.toContain('2030-03-14T15:00:00.000Z');
  });

  it('omits the optional phone/address rows when the guest has neither', async () => {
    await service.sendConfirmationEmail(
      { ...APPOINTMENT, guestPhone: null },
      { ...BUSINESS, address: null },
    );

    const html: string = sendMail.mock.calls[0][0].html;
    expect(html).not.toContain('Teléfono');
    expect(html).not.toContain('Dirección');
    expect(html).toContain('Ana Pérez');
  });

  it('renders the reschedule body with the new date', async () => {
    await service.sendRescheduleEmail(
      { guestName: 'Ana', guestEmail: 'ana@example.com', startsAt: new Date('2030-04-01T09:00:00.000Z') },
      BUSINESS,
    );

    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: 'ana@example.com',
      subject: 'Cita reprogramada en Salón X',
    });
    expect(sendMail.mock.calls[0][0].html).toContain('Nueva fecha');
  });

  it('e-mails the generated password (subject + html + text) to the account owner', async () => {
    await service.sendPasswordResetEmail('owner@example.com', 'NewPass12345678');

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message).toMatchObject({
      to: 'owner@example.com',
      subject: 'Tu nueva contraseña de Boo-king',
    });
    expect(message.html).toContain('NewPass12345678');
    expect(message.text).toContain('NewPass12345678');
  });

  it('swallows a password-reset transport failure (fire-and-forget) and logs it', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.sendPasswordResetEmail('owner@example.com', 'NewPass12345678'),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Password reset email error:',
      expect.any(Error),
    );
  });

  it('swallows a confirmation transport failure (fire-and-forget) and logs it', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.sendConfirmationEmail(APPOINTMENT, BUSINESS)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('Email send error:', expect.any(Error));
  });

  it('swallows a reschedule transport failure (fire-and-forget) and logs it', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.sendRescheduleEmail(APPOINTMENT, BUSINESS)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('Reschedule email error:', expect.any(Error));
  });
});
