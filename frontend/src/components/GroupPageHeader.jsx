import { pageSubtitle } from '../ui'

/**
 * Shared page header for scoped group routes (matches Dashboard & Meetings).
 */
export default function GroupPageHeader({
  title,
  icon: Icon,
  iconClassName,
  subtitle,
  children,
  actions,
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-stone-200 pb-6 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="mb-2 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 sm:text-3xl">
          {Icon ? (
            <Icon className="h-7 w-7 shrink-0 text-emerald-700" aria-hidden />
          ) : null}
          {iconClassName ? (
            <i className={`${iconClassName} text-[1.4rem] text-emerald-700`} aria-hidden />
          ) : null}
          {title}
        </h1>
        {subtitle ? (
          <p className={`${pageSubtitle} text-stone-600 dark:text-stone-300`}>{subtitle}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  )
}
