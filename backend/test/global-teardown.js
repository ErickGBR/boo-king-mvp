/**
 * Jest `globalTeardown` — best-effort cleanup of the throwaway SQLite file.
 * The file is git-ignored (`*.db`) regardless; this just keeps the worktree tidy.
 */
const path = require('path');
const fs = require('fs');

module.exports = async () => {
  const dbFile = path.resolve(__dirname, '.tmp', 'test.db');
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try {
      fs.rmSync(dbFile + suffix, { force: true });
    } catch {
      /* ignore: a still-open handle must not fail the run */
    }
  }
};
