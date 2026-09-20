import type { ReactNode } from 'react'
import { Link } from '../Link'
import { brand } from '../../brand'

interface LegalPageLayoutProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10">
      <Link to="/" className="text-sm font-medium text-purple-700 hover:underline">
        ← Back to {brand.name}
      </Link>
      <h1 className="mt-6 text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">Last updated: {lastUpdated}</p>
      <div className="mt-6 text-sm leading-relaxed text-slate-700 [&>h2]:mt-6 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:text-slate-900 [&>p]:mt-3 [&>ul]:mt-3 [&>ul]:list-disc [&>ul]:space-y-1 [&>ul]:pl-5">
        {children}
      </div>
      <footer className="mt-10 flex gap-4 border-t border-slate-200 pt-6 text-xs text-slate-400">
        <Link to="/privacy" className="hover:text-slate-600 hover:underline">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-slate-600 hover:underline">
          Terms
        </Link>
      </footer>
    </div>
  )
}
