export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'query'
}

/** `citescape-<query-slug>-<date>.<ext>`, date defaulting to today. */
export function exportFilename(query: string, ext: string, date: Date = new Date()): string {
  const dateStr = date.toISOString().slice(0, 10)
  return `citescape-${slugify(query)}-${dateStr}.${ext}`
}
