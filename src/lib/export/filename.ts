import { brand } from '../../brand'

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'query'
}

/** e.g. "citescape" — the app-name slug every export filename starts with. */
const APP_SLUG = slugify(brand.name)

export type ExportNetworkKind = 'coupling' | 'cocitation'

export interface ExportFilenameOptions {
  /** Omit for exports that cover both networks (currently just Excel). */
  network?: ExportNetworkKind
  date?: Date
}

/**
 * `<app-slug>-<query-slug>-<date>.<ext>`, or with `network` set,
 * `<app-slug>-<query-slug>-<coupling|cocitation>-<date>.<ext>`.
 */
export function exportFilename(query: string, ext: string, options: ExportFilenameOptions = {}): string {
  const date = options.date ?? new Date()
  const dateStr = date.toISOString().slice(0, 10)
  const networkPart = options.network ? `-${options.network}` : ''
  return `${APP_SLUG}-${slugify(query)}${networkPart}-${dateStr}.${ext}`
}
