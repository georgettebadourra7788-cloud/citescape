import { buildPajek } from './pajek'
import { downloadText } from './download'
import { exportFilename, type ExportNetworkKind } from './filename'
import type { NetworkResult } from '../graph/types'

export function exportPajek(network: NetworkResult, query: string, networkKind: ExportNetworkKind): void {
  const text = buildPajek(network)
  downloadText(text, exportFilename(query, 'net', { network: networkKind }), 'text/plain')
}
