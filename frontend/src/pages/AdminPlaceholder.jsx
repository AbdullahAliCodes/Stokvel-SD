import { pageSubtitle } from '../ui'

export default function AdminPlaceholder({ title }) {
  return (
    <div>
      <h1 className="mb-2 text-xl font-bold tracking-wide text-cyan-400">{title}</h1>
      <p className={pageSubtitle}>Placeholder — content coming soon</p>
      <div className="mt-8 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-12 text-center text-slate-500">
        This section matches the wireframe shell; hook up data when ready.
      </div>
    </div>
  )
}
