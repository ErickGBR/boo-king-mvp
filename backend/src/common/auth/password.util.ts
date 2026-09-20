import crypto from 'crypto';

/**
 * Secure random password generator for the "forgot password" flow.
 *
 * The clear-text password exists ONLY in memory long enough to be bcrypt-hashed
 * and e-mailed: it is never persisted, logged or returned by the API.
 *
 * Uses `crypto.randomInt` (not `Math.random`) so the output is
 * cryptographically strong and free of modulo bias. The ambiguous characters
 * `I`, `l`, `O`, `0` and `1` are excluded because this password is meant to be
 * read from an e-mail and typed by a human.
 */
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPERCASE + LOWERCASE + DIGITS;

/** Minimum allowed length (requirement: at least 12 characters). */
export const MIN_PASSWORD_LENGTH = 12;

/** Default generated length — longer than the minimum, still human-typeable. */
export const DEFAULT_GENERATED_PASSWORD_LENGTH = 16;

function pick(chars: string): string {
  return chars[crypto.randomInt(chars.length)];
}

/**
 * Generates a random password containing at least one uppercase letter, one
 * lowercase letter and one digit.
 */
export function generateSecurePassword(
  length: number = DEFAULT_GENERATED_PASSWORD_LENGTH,
): string {
  if (length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password length must be at least ${MIN_PASSWORD_LENGTH}`);
  }

  // Guarantee one character of each required class, then fill the rest.
  const chars = [pick(UPPERCASE), pick(LOWERCASE), pick(DIGITS)];
  while (chars.length < length) {
    chars.push(pick(ALL));
  }

  // Fisher-Yates shuffle with a CSPRNG, so the mandatory characters are not in
  // fixed positions (which would make the pattern predictable).
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
