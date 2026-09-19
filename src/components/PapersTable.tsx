import { useMemo, useState } from 'react'
import { truncateTitle } from '../lib/text'
import type { Paper } from '../lib/openalex'

type SortKey = 'title' | 'authors' | 'year' | 'citedByCount' | 'referencedWorks'
type SortDirection = 'asc' | 'desc'

interface PapersTableProps {
  papers: Paper[]
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'authors', label: 'Authors' },
  { key: 'year', label: 'Year' },
  { key: 'citedByCount', label: 'Citations' },
  { key: 'referencedWorks', label: 'References' },
]

function sortValue(paper: Paper, key: SortKey): string | number {
  switch (key) {
    case 'title':
      return paper.title.toLowerCase()
    case 'authors':
      return paper.authors.join(', ').toLowerCase()
    case 'year':
      return paper.year ?? -Infinity
    case 'citedByCount':
      return paper.citedByCount
    case 'referencedWorks':
      return paper.referencedWorks.length
  }
}

export function PapersTable({ papers }: PapersTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('citedByCount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const sorted = useMemo(() => {
    const copy = [...papers]
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (av < bv) return sortDirection === 'asc' ? -1 : 1
      if (av > bv) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [papers, sortKey, sortDirection])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection(key === 'title' || key === 'authors' ? 'asc' : 'desc')
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} scope="col" className="px-4 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => handleSort(col.key)}
                  className="flex items-center gap-1 hover:text-slate-900"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((paper) => (
            <tr key={paper.id} className="align-top">
              <td className="max-w-md px-4 py-2 text-slate-900" title={paper.title}>
                {truncateTitle(paper.title)}
              </td>
              <td className="max-w-xs px-4 py-2 text-slate-600">
                {paper.authors.length > 0 ? paper.authors.join(', ') : '—'}
              </td>
              <td className="px-4 py-2 text-slate-600">{paper.year ?? '—'}</td>
              <td className="px-4 py-2 text-slate-600">{paper.citedByCount}</td>
              <td className="px-4 py-2 text-slate-600">{paper.referencedWorks.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
