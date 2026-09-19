import { buildGexf } from './gexf'
import { downloadText } from './download'
import { exportFilename } from './filename'
import type { NetworkResult } from '../graph/types'

export function exportGexf(network: NetworkResult, query: string, networkLabel: string): void {
  const xml = buildGexf(network, { title: `${query} — ${networkLabel}` })
  downloadText(xml, exportFilename(query, 'gexf'), 'application/xml')
}
