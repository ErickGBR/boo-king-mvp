/**
 * Runs via Jest `setupFiles`, i.e. BEFORE each test file (and therefore before
 * any `src/**` module) is loaded. It must reproduce the exact throwaway
 * environment the global setup created and keep the test run hermetic:
 *
 *  - DATABASE_URL → the throwaway SQLite file (`test/.tmp/test.db`);
 *  - JWT_SECRET    → required by `validateEnv` and by token.util (fail-fast);
 *  - GOOGLE_*      → emptied so `verifyGoogleToken` short-circuits to null and
 *                    no real Google client is ever exercised;
 *  - SMTP_*        → pointed at an unroutable local port so the fire-and-forget
 *                    mailer fails fast (ECONNREFUSED) instead of doing DNS/SMTP.
 */
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:' + path.resolve(__dirname, '.tmp', 'test.db');
process.env.JWT_SECRET = 'stage4-jest-secret';
process.env.FRONTEND_URL = 'http://localhost:3000';

// No Google credentials: `new OAuth2Client(undefined)` builds a URL offline and
// `verifyGoogleToken` returns null without any network call.
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:4000/api/google/callback';

// Mailer: fail fast, never touch the network.
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.SMTP_FROM = 'noreply@boo-king.com';
