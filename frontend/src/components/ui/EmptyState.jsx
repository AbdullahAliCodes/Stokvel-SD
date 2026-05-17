import { cardLight } from '../../ui'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
  variant = 'dashed',
}) {
  const shellClass =
    variant === 'card'
      ? `${cardLight} p-8`
      : 'rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 px-6 py-10 dark:border-slate-700 dark:bg-slate-800/60'

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${shellClass} ${className}`.trim()}
      role="status"
    >
      {Icon ? (
        <Icon
          className="mb-4 h-10 w-10 text-emerald-700/70 dark:text-emerald-400/80"
          aria-hidden
        />
      ) : null}
      <h3 className="text-base font-semibold text-stone-800 dark:text-stone-100">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
