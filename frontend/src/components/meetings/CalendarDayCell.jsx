/**
 * One cell in the month grid: day number, optional meeting preview, selected state.
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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[4.5rem] flex-col items-stretch rounded-xl border p-1.5 text-left transition sm:min-h-[5.25rem] sm:p-2 ${
        selected
          ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/30"
          : "border-stone-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
      } ${isToday ? "shadow-sm ring-1 ring-emerald-700/25" : ""}`}
    >
      <span
        className={`text-xs font-semibold sm:text-sm ${
          isToday ? "text-emerald-800" : "text-stone-700"
        }`}
      >
        {dayNumber}
        {isToday ? (
          <span className="ml-1 text-[10px] font-medium uppercase text-emerald-600">
            Today
          </span>
        ) : null}
      </span>
      {hasMeetings ? (
        <div className="mt-auto min-h-0 flex-1">
          {previewTitle ? (
            <p
              className="line-clamp-2 text-[10px] leading-tight text-stone-700 sm:text-xs"
              title={previewTitle}
            >
              {previewTitle}
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex h-1.5 min-w-[1.25rem] flex-wrap gap-0.5">
              {Array.from({ length: Math.min(meetingCount, 3) }).map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600"
                  aria-hidden
                />
              ))}
            </span>
            {meetingCount > 1 ? (
              <span className="text-[10px] font-medium text-stone-500">
                +{meetingCount - 1}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <span className="mt-auto text-[10px] text-stone-300 sm:text-xs"> </span>
      )}
    </button>
  );
}
