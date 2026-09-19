import type { Paper } from '../lib/openalex'

interface ResultsSummaryProps {
  papers: Paper[]
}

export function ResultsSummary({ papers }: ResultsSummaryProps) {
  const years = papers.map((p) => p.year).filter((y): y is number => y !== null)
  const yearRange = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : '—'
  const withReferences = papers.filter((p) => p.referencedWorks.length > 0).length

  const stats = [
    { label: 'Papers', value: papers.length },
    { label: 'Year range', value: yearRange },
    { label: 'With references', value: `${withReferences} / ${papers.length}` },
  ]

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-slate-200 px-4 py-3">
          <dt className="text-sm text-slate-500">{stat.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}
