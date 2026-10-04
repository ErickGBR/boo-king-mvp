import bcrypt from 'bcryptjs';
import { AuthService } from '../../src/modules/auth/auth.service';
import { verifyToken } from '../../src/common/auth/token.util';

/**
 * Unit contract for AuthService (R2/R5/R9): email/password flows, the token it
 * issues, and the Google auth-code flow branching.
 */
describe('AuthService', () => {
  let prisma: any;
  let google: any;
  let mailer: any;
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
    google = { exchangeCode: jest.fn(), verifyGoogleToken: jest.fn() };
    mailer = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(prisma, google, mailer);
  });

  describe('register', () => {
    it('422 when the email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'a@b.com' });
      const error = await service
        .register({ name: 'A', email: 'a@b.com', password: 'password1' })
        .catch((e) => e);
      expect(error.getStatus()).toBe(422);
      expect(error.getResponse()).toEqual({ error: 'Email already registered' });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates the user, hashes nothing in the response and signs a userId token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 7, name: 'A', email: 'a@b.com', role: 'owner' });

      const result = await service.register({
        name: 'A',
        email: 'a@b.com',
        password: 'password1',
      });

      const storedPassword = prisma.user.create.mock.calls[0][0].data.password;
      expect(storedPassword).not.toBe('password1');
      expect(await bcrypt.compare('password1', storedPassword)).toBe(true);
      expect(result.user).toEqual({ id: 7, name: 'A', email: 'a@b.com', role: 'owner' });
      expect(verifyToken(result.token).userId).toBe(7);
    });
  });

  describe('login', () => {
    it('401 for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const error = await service
        .login({ email: 'a@b.com', password: 'x' })
        .catch((e) => e);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toEqual({ error: 'Invalid credentials' });
    });

    it('401 for a Google-only user with no password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, password: null });
      const error = await service
        .login({ email: 'a@b.com', password: 'x' })
        .catch((e) => e);
      expect(error.getStatus()).toBe(401);
    });

    it('401 for a wrong password', async () => {
      const password = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 1, password });
      const error = await service
        .login({ email: 'a@b.com', password: 'wrong' })
        .catch((e) => e);
      expect(error.getStatus()).toBe(401);
    });

    it('returns the projection + token on success', async () => {
      const password = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 4,
        name: 'A',
        email: 'a@b.com',
        role: 'admin',
        avatar: 'pic',
        password,
      });

      const result = await service.login({ email: 'a@b.com', password: 'correct' });

      expect(result.user).toEqual({
        id: 4,
        name: 'A',
        email: 'a@b.com',
        role: 'admin',
        avatar: 'pic',
      });
      expect(verifyToken(result.token).userId).toBe(4);
    });
  });

  describe('updateMe', () => {
    it('400 "Nothing to update" when both fields are absent', async () => {
      const error = await service.updateMe(1, {}).catch((e) => e);
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toEqual({ error: 'Nothing to update' });
    });

    it('updates only the name', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, name: 'New' });
      await service.updateMe(1, { name: 'New' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'New' },
        select: expect.any(Object),
      });
    });

    it('hashes a new password before persisting', async () => {
      prisma.user.update.mockResolvedValue({ id: 1 });
      await service.updateMe(1, { password: 'brandnewpass' });
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.password).not.toBe('brandnewpass');
      expect(await bcrypt.compare('brandnewpass', data.password)).toBe(true);
    });
  });

  describe('forgotPassword', () => {
    it('stores a bcrypt hash and e-mails the clear-text password for a known user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 2, email: 'ana@example.com' });
      prisma.user.update.mockResolvedValue({ id: 2 });

      const result = await service.forgotPassword({ email: 'ana@example.com' });

      expect(result).toEqual({ ok: true });
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'ana@example.com' } }),
      );

      const stored = prisma.user.update.mock.calls[0][0].data.password;
      expect(stored).toMatch(/^\$2[aby]\$/); // bcrypt, NOT sha256
      expect(mailer.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

      const [to, plain] = mailer.sendPasswordResetEmail.mock.calls[0];
      expect(to).toBe('ana@example.com');
      expect(plain).not.toBe(stored);
      expect(plain.length).toBeGreaterThanOrEqual(12);
      expect(await bcrypt.compare(plain, stored)).toBe(true);

      // The generated password is never echoed in the response.
      expect(JSON.stringify(result)).not.toContain(plain);
    });

    it('answers the same generic body for an unknown e-mail and sends nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'ghost@example.com' });

      expect(result).toEqual({ ok: true });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('still hashes (timing equalization) even when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const hashSpy = jest.spyOn(bcrypt, 'hash');

      await service.forgotPassword({ email: 'ghost@example.com' });

      expect(hashSpy).toHaveBeenCalledTimes(1);
      hashSpy.mockRestore();
    });

    it('stays generic (200 body) when the row disappears before the update (P2025)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 3, email: 'gone@example.com' });
      prisma.user.update.mockRejectedValue({ code: 'P2025' });

      const result = await service.forgotPassword({ email: 'gone@example.com' });

      expect(result).toEqual({ ok: true });
      expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('propagates unexpected database errors (do not hide outages as 200)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 4, email: 'db@example.com' });
      prisma.user.update.mockRejectedValue(new Error('db down'));

      await expect(service.forgotPassword({ email: 'db@example.com' })).rejects.toThrow('db down');
    });

    it('does not fail when the reset e-mail rejects (fire-and-forget)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 5, email: 'mail@example.com' });
      prisma.user.update.mockResolvedValue({ id: 5 });
      mailer.sendPasswordResetEmail.mockRejectedValue(new Error('SMTP down'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(service.forgotPassword({ email: 'mail@example.com' })).resolves.toEqual({
        ok: true,
      });
      // Let the rejected fire-and-forget promise settle.
      await new Promise((resolve) => setImmediate(resolve));
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('googleLogin', () => {
    it('422 when the code is missing or not a string', async () => {
      for (const body of [{}, { code: 12 }, { code: '' }, undefined]) {
        const error = await service.googleLogin(body).catch((e) => e);
        expect(error.getStatus()).toBe(422);
        expect(error.getResponse()).toEqual({ error: 'Google authorization code required' });
      }
    });

    it('401 "Invalid Google code" when the exchange has no id_token', async () => {
      google.exchangeCode.mockResolvedValue({});
      const error = await service.googleLogin({ code: 'abc' }).catch((e) => e);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toEqual({ error: 'Invalid Google code' });
    });

    it('401 "Invalid Google token" when verification yields no verified email', async () => {
      google.exchangeCode.mockResolvedValue({ id_token: 't' });
      google.verifyGoogleToken.mockResolvedValue({ email: 'a@b.com' }); // no email_verified
      const error = await service.googleLogin({ code: 'abc' }).catch((e) => e);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toEqual({ error: 'Invalid Google token' });
    });

    it('links an existing (non-Google) account and returns a token', async () => {
      google.exchangeCode.mockResolvedValue({ id_token: 't' });
      google.verifyGoogleToken.mockResolvedValue({
        email: 'a@b.com',
        email_verified: true,
        sub: 'google-sub',
        name: 'A',
        picture: 'pic',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 3,
        name: 'A',
        email: 'a@b.com',
        role: 'owner',
        avatar: null,
        googleId: null,
      });
      prisma.user.update.mockResolvedValue({
        id: 3,
        name: 'A',
        email: 'a@b.com',
        role: 'owner',
        avatar: 'pic',
      });

      const result = await service.googleLogin({ code: 'abc' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 } }),
      );
      expect(verifyToken(result.token).userId).toBe(3);
    });

    it('returns the existing Google-linked user unchanged', async () => {
      google.exchangeCode.mockResolvedValue({ id_token: 't' });
      google.verifyGoogleToken.mockResolvedValue({
        email: 'a@b.com',
        email_verified: true,
        sub: 'sub',
      });
      const user = { id: 5, email: 'a@b.com', googleId: 'sub', role: 'owner' };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.googleLogin({ code: 'abc' });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user).toBe(user);
    });

    it('creates a new user when the email is unknown', async () => {
      google.exchangeCode.mockResolvedValue({ id_token: 't' });
      google.verifyGoogleToken.mockResolvedValue({
        email: 'new@b.com',
        email_verified: true,
        sub: 'sub',
        name: 'New Person',
        picture: 'pic',
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 9, email: 'new@b.com' });

      const result = await service.googleLogin({ code: 'abc' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@b.com', password: null }),
        }),
      );
      expect(verifyToken(result.token).userId).toBe(9);
    });

    it('maps an unexpected Google failure to a generic 401', async () => {
      google.exchangeCode.mockRejectedValue(new Error('network down'));
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const error = await service.googleLogin({ code: 'abc' }).catch((e) => e);
      expect(error.getStatus()).toBe(401);
      expect(error.getResponse()).toEqual({ error: 'Google authentication failed' });
    });
  });
});
