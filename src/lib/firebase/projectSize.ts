// Firestore documents are capped at 1 MiB; stay well under that so field
// overhead (Firestore's own per-document/per-field bookkeeping) never
// tips a document over the real server-side limit.
export const MAX_PROJECT_DOC_BYTES = 900 * 1024

export function estimateDocBytes(data: unknown): number {
  return new TextEncoder().encode(JSON.stringify(data)).length
}

export class ProjectTooLargeError extends Error {}

export function assertWithinSizeLimit(data: unknown): void {
  const bytes = estimateDocBytes(data)
  if (bytes > MAX_PROJECT_DOC_BYTES) {
    const kb = (n: number) => (n / 1024).toFixed(0)
    throw new ProjectTooLargeError(
      `This project is too large to save (about ${kb(bytes)} KB; the limit is ${kb(MAX_PROJECT_DOC_BYTES)} KB). Try a smaller topic search.`,
    )
  }
}
