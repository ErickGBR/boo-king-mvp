/**
 * Environment validation, run by `ConfigModule.forRoot({ validate })` at
 * bootstrap. Replaces the import-time `throw` of the old
 * `src/middleware/auth.js` (C1 security rule): without JWT_SECRET the process
 * refuses to boot instead of running with an unsafe default.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  // CRITICAL (C1) — never fall back to a hardcoded JWT secret. With a known
  // default secret anyone could forge valid tokens and take over any account.
  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in environment');
  }
  return config;
}

/**
 * Allowed CORS origins, parsed exactly like the old `src/index.js`
 * (`split(',').map(trim).filter(Boolean)`).
 */
export function getAllowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default () => ({
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  allowedOrigins: getAllowedOrigins(),
});
