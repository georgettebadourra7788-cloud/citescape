/** Triggers a browser download of `blob` as `filename` — no server involved. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadText(text: string, filename: string, mimeType: string): void {
  triggerDownload(new Blob([text], { type: mimeType }), filename)
}
