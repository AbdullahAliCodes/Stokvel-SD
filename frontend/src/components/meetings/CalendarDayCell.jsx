/**
 * One cell in the month grid: day number, optional meeting preview, selected state.
 * Sizing is driven by the parent grid (`minmax` row height + `h-full`); this button fills the cell.
 */
export default function CalendarDayCell({
  dayNumber,
  isToday,
  meetingCount,
  /** First meeting title for a subtle preview (truncated by parent if needed) */
  previewTitle,
  selected,
  onClick,
}) {
  const hasMeetings = meetingCount > 0;

  const base =
    "group relative flex h-full min-h-0 w-full flex-col rounded-2xl border text-left shadow-sm transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

  const todayStyle = isToday
    ? "border-emerald-300/90 bg-gradient-to-b from-emerald-50 via-white to-white shadow-emerald-900/5 before:pointer-events-none before:absolute before:inset-x-2 before:top-1.5 before:h-1 before:rounded-full before:bg-emerald-500/85 dark:border-emerald-700/70 dark:from-slate-800 dark:via-slate-900 dark:to-slate-900"
    : "border-stone-200/95 bg-white dark:border-slate-700 dark:bg-slate-900";

  const selectedStyle = selected
    ? "z-[1] border-emerald-600 bg-emerald-50/90 shadow-md ring-2 ring-emerald-600/35 ring-offset-1 ring-offset-white dark:bg-emerald-900/30 dark:ring-offset-slate-900"
    : "";

  const hoverStyle = selected
    ? "hover:bg-emerald-50"
    : "hover:z-[1] hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md hover:shadow-stone-300/40 active:translate-y-0 active:shadow-sm";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${todayStyle} ${selectedStyle} ${hoverStyle} p-2.5 pb-2 sm:p-3 sm:pb-2.5`}
    >
      <div className="flex shrink-0 items-baseline gap-1.5">
        <span
          className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg text-sm font-bold tabular-nums sm:h-8 sm:min-w-[2rem] sm:text-base ${
            isToday
            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/15 dark:bg-emerald-500"
              : "bg-stone-100/90 text-stone-800 group-hover:bg-emerald-100/80 group-hover:text-emerald-900 dark:bg-slate-800 dark:text-stone-100 dark:group-hover:bg-emerald-900/40 dark:group-hover:text-emerald-200"
          } ${selected && !isToday ? "bg-emerald-100 text-emerald-900" : ""} ${
            selected && isToday ? "bg-emerald-700 text-white" : ""
          }`}
        >
          {dayNumber}
        </span>
        {isToday ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 sm:text-xs">
            Today
          </span>
        ) : null}
      </div>

      {hasMeetings ? (
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
          {previewTitle ? (
            <p
              className="line-clamp-3 text-[11px] font-medium leading-snug text-stone-800 dark:text-stone-100 sm:text-xs sm:leading-relaxed"
              title={previewTitle}
            >
              {previewTitle}
            </p>
          ) : null}
          <div className="mt-auto flex items-center gap-2 pt-0.5">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-700/60 sm:text-xs"
              aria-label={`${meetingCount} meeting${meetingCount === 1 ? "" : "s"}`}
            >
              <span className="flex gap-1" aria-hidden>
                {Array.from({ length: Math.min(meetingCount, 3) }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-emerald-600 sm:h-2 sm:w-2"
                  />
                ))}
              </span>
              {meetingCount > 1 ? <span>+{meetingCount - 1}</span> : null}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2 min-h-[2.5rem] flex-1 rounded-lg bg-stone-50/60 dark:bg-slate-800/70 sm:min-h-[2.75rem]" aria-hidden />
      )}
    </button>
  );
}
