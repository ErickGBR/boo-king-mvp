import {
  generateSecurePassword,
  DEFAULT_GENERATED_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../src/common/auth/password.util';

/** Contract for the forgot-password generator: 12+ chars, all three classes. */
describe('generateSecurePassword', () => {
  it('generates a 16-char password with upper, lower and digits', () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(DEFAULT_GENERATED_PASSWORD_LENGTH);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
  });

  it('honours a custom length', () => {
    expect(generateSecurePassword(20)).toHaveLength(20);
  });

  it('rejects lengths below the 12-char minimum', () => {
    expect(() => generateSecurePassword(MIN_PASSWORD_LENGTH - 1)).toThrow(/at least 12/);
  });

  it('never repeats the same value (CSPRNG, not Math.random)', () => {
    const samples = new Set(Array.from({ length: 200 }, () => generateSecurePassword()));
    expect(samples.size).toBe(200);
  });

  it('does not contain the ambiguous characters I, l, O, 0 or 1', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateSecurePassword()).not.toMatch(/[IlO01]/);
    }
  });
});
