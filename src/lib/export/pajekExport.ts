import { buildPajek } from './pajek'
import { downloadText } from './download'
import { exportFilename } from './filename'
import type { NetworkResult } from '../graph/types'

export function exportPajek(network: NetworkResult, query: string): void {
  const text = buildPajek(network)
  downloadText(text, exportFilename(query, 'net'), 'text/plain')
}
