import * as XLSX from 'xlsx'
import {
  buildAboutRows,
  buildClustersRows,
  buildCoCitationNodesRows,
  buildEdgesRows,
  buildPapersRows,
} from './excelRows'
import { triggerDownload } from './download'
import { exportFilename } from './filename'
import type { ExportContext } from './exportContext'

/** Excel sheet names must be <=31 chars with no : \ / ? * [ ] — all of ours qualify. */
export function exportExcelWorkbook(context: ExportContext): void {
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildPapersRows(context)),
    'Papers',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildClustersRows(context)),
    'Clusters',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildCoCitationNodesRows(context)),
    'Co-citation nodes',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildEdgesRows(context.coupling)),
    'Edges - Coupling',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildEdgesRows(context.coCitation)),
    'Edges - Co-citation',
  )
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildAboutRows(context)),
    'About',
  )

  const bytes = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer
  triggerDownload(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    exportFilename(context.query, 'xlsx'),
  )
}
