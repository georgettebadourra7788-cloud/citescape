import { buildGexf } from './gexf'
import { downloadText } from './download'
import { exportFilename, type ExportNetworkKind } from './filename'
import type { NetworkResult } from '../graph/types'

export function exportGexf(
  network: NetworkResult,
  query: string,
  networkLabel: string,
  networkKind: ExportNetworkKind,
): void {
  const xml = buildGexf(network, { title: `${query} — ${networkLabel}` })
  downloadText(xml, exportFilename(query, 'gexf', { network: networkKind }), 'application/xml')
}
