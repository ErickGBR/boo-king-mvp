/**
 * Jest configuration for the NestJS backend (Stage 4).
 *
 * Why ts-jest (not @swc/jest): Nest DI depends on `emitDecoratorMetadata`, and
 * ts-jest compiles every file with the SAME TypeScript compiler and flags the
 * app uses (tsconfig.test.json extends tsconfig.json). @swc/jest would need the
 * decorator-metadata flags mirrored by hand plus an extra native binary, and
 * this codebase is small enough that compile speed is not a bottleneck.
 *
 * The config is CommonJS (the project dropped `"type":"module"` in Wave B1) and
 * lives OUTSIDE tsconfig.build.json's scope, so `nest build` is unaffected:
 *   - tsconfig.build.json excludes `test` and `**\/*spec.ts`;
 *   - this file is a `.js` file (allowJs is off), never compiled by `nest build`.
 */
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/unit/**/*.spec.ts',
    '<rootDir>/test/e2e/**/*.e2e-spec.ts',
  ],
  transform: {
    // `isolatedModules` (set in tsconfig.test.json) makes ts-jest transpile
    // file-by-file with `ts.transpileModule` instead of type-checking a whole
    // program: it keeps memory flat (the full graph — incl. `googleapis` .d.ts —
    // is validated by `nest build`, not here) while still emitting decorator
    // metadata for DI.
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // Env vars (throwaway DATABASE_URL, JWT_SECRET, SMTP fast-fail) must exist
  // before any module is imported — this runs before each test file is loaded.
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // One throwaway SQLite schema, created once for the whole run.
  globalSetup: '<rootDir>/test/global-setup.js',
  globalTeardown: '<rootDir>/test/global-teardown.js',
  // Coverage target: the cross-cutting layer + every service with real logic.
  collectCoverageFrom: [
    'src/common/**/*.ts',
    'src/modules/**/*.service.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  // Ratchet so the next wave cannot silently regress the suite. Floors are set
  // BELOW the observed baseline (statements 95.89 / branches 80.99 /
  // functions 98.37 / lines 97.88) with deliberate headroom: a red build must
  // mean "coverage actually dropped", not "someone touched an edge case".
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 75,
      functions: 90,
      lines: 90,
    },
  },
  // SQLite is a single file: run test files serially so concurrent writers can
  // never race (and the shared in-memory rate-limit stores stay deterministic).
  maxWorkers: 1,
  testTimeout: 30000,
  clearMocks: true,
};
