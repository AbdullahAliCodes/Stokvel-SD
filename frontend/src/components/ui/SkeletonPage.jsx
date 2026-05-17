import Skeleton from './Skeleton'

export default function SkeletonPage({ variant = 'table', className = '' }) {
  if (variant === 'form') {
    return (
      <div className={`mx-auto w-full max-w-2xl space-y-6 p-6 ${className}`.trim()}>
        <Skeleton height={32} width="55%" rounded="rounded-md" />
        <Skeleton height={16} width="70%" />
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton height={14} width="30%" />
              <Skeleton height={40} className="w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 p-6 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton height={28} width={220} />
          <Skeleton height={14} width={320} />
        </div>
        <Skeleton height={40} width={120} rounded="rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={88} className="w-full" rounded="rounded-2xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-700">
        <Skeleton height={44} className="w-full" rounded="rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            height={52}
            className="w-full border-t border-stone-100 dark:border-slate-800"
            rounded="rounded-none"
          />
        ))}
      </div>
    </div>
  )
}
