/** Date helpers of `routes/reports.js` — MOVED VERBATIM. */

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Parse a YYYY-MM-DD (or ISO datetime) query param into a local-midnight Date
 * without the UTC-shift pitfall that `new Date('2026-08-01')` causes.
 */
function parseDateParam(str: any): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  return new Date(y, mo - 1, d); // local midnight
}

/** Format a Date as YYYY-MM-DD using LOCAL component values (no UTC shift). */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dd}`;
}

export { startOfDay, endOfDay, addDays, parseDateParam, toLocalDateStr };
