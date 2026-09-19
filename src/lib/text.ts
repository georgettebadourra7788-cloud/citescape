/**
 * Truncates a title for display so one malformed OpenAlex record (a
 * concatenated abstract mistaken for a title, etc.) can't flood the UI.
 * The underlying data is left untouched — this is a render-time concern.
 */
export function truncateTitle(title: string, maxLength = 120): string {
  if (title.length <= maxLength) return title
  return `${title.slice(0, maxLength).trimEnd()}…`
}
