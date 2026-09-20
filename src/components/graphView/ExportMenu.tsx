import { useState } from 'react'
import { isPro } from '../../lib/entitlements'
import type { ExportContext } from '../../lib/export/exportContext'
import type { ExportNetworkKind } from '../../lib/export/filename'
import type { NetworkResult } from '../../lib/graph/types'
import type { NetworkSigma } from './NetworkGraph'

interface ExportMenuProps {
  context: ExportContext
  activeNetwork: NetworkResult
  activeNetworkLabel: string
  networkKind: ExportNetworkKind
  unitLabel: 'papers' | 'works'
  minLinkStrength: number
  sigma: NetworkSigma | null
}

export function ExportMenu({
  context,
  activeNetwork,
  activeNetworkLabel,
  networkKind,
  unitLabel,
  minLinkStrength,
  sigma,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [busyLabel, setBusyLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const title = `${context.query} — ${activeNetworkLabel}`

  // Each export format's code (and, for Excel, the sizable xlsx library)
  // only loads when that specific option is actually clicked, so the
  // landing page and map don't pay for export code most visitors never use.
  async function runExport(label: string, run: () => Promise<void> | void) {
    setError(null)
    setBusyLabel(label)
    try {
      await run()
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not export ${label}.`)
    } finally {
      setBusyLabel(null)
    }
  }

  const items: { label: string; description: string; onClick: () => void; disabled?: boolean }[] = [
    {
      label: 'PNG (2x)',
      description: 'Current map + legend',
      disabled: !sigma,
      onClick: () =>
        runExport('PNG', async () => {
          const { exportPng } = await import('../../lib/export/pngExport')
          if (!sigma) return
          await exportPng(
            { sigma, network: activeNetwork, unitLabel, title, watermark: !isPro },
            context.query,
            networkKind,
          )
        }),
    },
    {
      label: 'SVG',
      description: 'Editable vector, current map + legend',
      onClick: () =>
        runExport('SVG', async () => {
          const { exportSvg } = await import('../../lib/export/svgExport')
          exportSvg(
            { network: activeNetwork, unitLabel, minLinkStrength, title, watermark: !isPro },
            context.query,
            networkKind,
          )
        }),
    },
    {
      label: 'Excel workbook (.xlsx)',
      description: 'Papers, clusters, edges, About — both networks',
      onClick: () =>
        runExport('Excel workbook', async () => {
          const { exportExcelWorkbook } = await import('../../lib/export/excelExport')
          exportExcelWorkbook(context)
        }),
    },
    {
      label: 'GEXF',
      description: 'Opens in Gephi',
      onClick: () =>
        runExport('GEXF', async () => {
          const { exportGexf } = await import('../../lib/export/gexfExport')
          exportGexf(activeNetwork, context.query, activeNetworkLabel, networkKind)
        }),
    },
    {
      label: 'Pajek (.net)',
      description: 'Opens in VOSviewer or Gephi',
      onClick: () =>
        runExport('Pajek', async () => {
          const { exportPajek } = await import('../../lib/export/pajekExport')
          exportPajek(activeNetwork, context.query, networkKind)
        }),
    },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        aria-expanded={isOpen}
      >
        Export ▾
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                disabled={item.disabled || busyLabel !== null}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block font-medium text-slate-900">
                  {busyLabel === item.label ? `Exporting ${item.label}…` : item.label}
                </span>
                <span className="block text-xs text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="absolute right-0 mt-1 w-64 text-xs text-red-700">{error}</p>}
    </div>
  )
}
