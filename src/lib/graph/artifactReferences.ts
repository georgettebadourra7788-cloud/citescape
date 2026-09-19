/**
 * OpenAlex work ids that are known data-quality artifacts rather than real
 * scholarly references, and must never be treated as a genuine shared
 * reference (coupling) or co-cited reference (co-citation).
 *
 * W4285719527 is OpenAlex's single generic "deleted work" placeholder:
 * millions of merged/removed work ids redirect their `referenced_works`
 * entries to this one id. Left in, it would show up as an artificially
 * huge, meaningless hub in both networks — any two papers that happen to
 * cite something that got merged away would look "coupled", and it would
 * dominate co-citation strength rankings. It's a real, resolvable OpenAlex
 * record (not a lookup failure on our side) — see
 * https://groups.google.com/g/openalex-users/c/-rF8iiYPcjY
 */
export const KNOWN_ARTIFACT_REFERENCE_IDS = new Set<string>([
  'https://openalex.org/W4285719527',
])

export function stripArtifactReferences(referencedWorks: string[]): string[] {
  if (!referencedWorks.some((ref) => KNOWN_ARTIFACT_REFERENCE_IDS.has(ref))) {
    return referencedWorks
  }
  return referencedWorks.filter((ref) => !KNOWN_ARTIFACT_REFERENCE_IDS.has(ref))
}
