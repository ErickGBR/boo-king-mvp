/**
 * Jest `globalSetup` (plain CommonJS so it never depends on the transform).
 *
 * Creates a THROWAWAY SQLite database for the whole run (`test/.tmp/test.db`)
 * via `prisma db push`, then seeds only the minimal global fixtures that every
 * suite may assume exists (the public category catalog). Users, businesses,
 * appointments, etc. are created per-suite by the tests themselves, so each
 * suite owns its data and isolation is explicit.
 *
 * The same path/env is recomputed in `test/setup-env.ts` for the test workers
 * (env does not propagate from globalSetup to workers).
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CATEGORIES = [
  { name: 'Test Barbería', slug: 'test-barberia', sort: 1 },
  { name: 'Test Spa', slug: 'test-spa', sort: 2 },
  { name: 'Test Dental', slug: 'test-dental', sort: 3 },
];

module.exports = async () => {
  const backendRoot = path.resolve(__dirname, '..');
  const dbFile = path.join(backendRoot, 'test', '.tmp', 'test.db');
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  try {
    fs.rmSync(dbFile, { force: true });
  } catch {
    /* fresh start is best-effort */
  }

  const url = 'file:' + dbFile;
  const prismaBin = path.join(backendRoot, 'node_modules', '.bin', 'prisma');

  execFileSync(prismaBin, ['db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });

  // Minimal global fixtures (categories are referenced by business creation).
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    // SQLite has no `createMany({ skipDuplicates })`, so upsert per row.
    for (const category of CATEGORIES) {
      await prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name, sort: category.sort },
        create: category,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
};
