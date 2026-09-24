/**
 * Builds a URL-safe slug from a business name (QA fix — degenerate slug).
 * MOVED VERBATIM from `routes/businesses.js`.
 */
export function buildSlug(name: string): string {
  const slug = String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return slug || `negocio-${Date.now()}`;
}
