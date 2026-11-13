/**
 * Storage-safe file name for uploads to the `activities` bucket.
 *
 * Keeps ASCII letters, digits, dot, dash and underscore; everything else
 * (spaces, accents, and the narrow no-break space macOS puts in screenshot
 * names like "Screenshot 2026-11-13 at 20.44.12.png") becomes "_". Used by
 * every upload path so a path that works for one capture route works for all.
 */
export function safeFileName(name: string | undefined | null): string {
  const cleaned = (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // drop combining accents: é -> e
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
  // Never return an empty name or a name that is only dots/underscores.
  return /[a-zA-Z0-9]/.test(cleaned) ? cleaned : 'upload'
}
