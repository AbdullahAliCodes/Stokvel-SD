import { useMemo, useState } from "react";
import { btnSecondary, cardLight } from "../../ui";
import CalendarDayCell from "./CalendarDayCell";
import {
  buildMonthGrid,
  groupMeetingsByLocalDateKey,
  toLocalDateKey,
} from "./meetingCalendarUtils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleString("en-ZA", {
    month: "long",
    year: "numeric",
  });
}

function truncate(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

/**
 * Month grid for stokvel meetings; uses the same meeting objects as the list view.
 */
export default function MeetingCalendar({
  meetings,
  /** YYYY-MM-DD — highlights the active day */
  selectedDateKey,
  onSelectDay,
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();

  const byDay = useMemo(
    () => groupMeetingsByLocalDateKey(meetings),
    [meetings],
  );

  const grid = useMemo(
    () => buildMonthGrid(year, monthIndex),
    [year, monthIndex],
  );

  const today = new Date();
  const todayKey = toLocalDateKey(today);

  function goPrevMonth() {
    setCursor(new Date(year, monthIndex - 1, 1));
  }

  function goNextMonth() {
    setCursor(new Date(year, monthIndex + 1, 1));
  }

  function goThisMonth() {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
  }

  return (
    <div className={`${cardLight} border border-stone-200 p-4 shadow-sm sm:p-6`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-emerald-800">
          {monthLabel(year, monthIndex)}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            className={`${btnSecondary} px-3 py-1.5 text-xs`}
            aria-label="Previous month"
          >
            <i className="fa-solid fa-chevron-left" aria-hidden />
          </button>
          <button
            type="button"
            onClick={goThisMonth}
            className={`${btnSecondary} px-3 py-1.5 text-xs`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNextMonth}
            className={`${btnSecondary} px-3 py-1.5 text-xs`}
            aria-label="Next month"
          >
            <i className="fa-solid fa-chevron-right" aria-hidden />
          </button>
        </div>
      </div>

      {/* Equal row heights: `minmax` keeps cells tall enough on small screens; `1fr` shares extra space on large screens */}
      <div
        className="grid grid-cols-7 gap-2 sm:gap-3 [grid-auto-rows:minmax(7.25rem,1fr)]"
        role="grid"
        aria-label="Meeting calendar"
      >
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="flex items-end justify-center pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-stone-500 sm:pb-2.5 sm:text-xs"
            role="columnheader"
          >
            {wd}
          </div>
        ))}
        {grid.map((cell, idx) => {
          if (cell.type === "empty") {
            return (
              <div
                key={`e-${idx}`}
                className="min-h-0 rounded-2xl border border-transparent bg-stone-50/40"
                aria-hidden
              />
            );
          }
          const { date } = cell;
          const key = toLocalDateKey(date);
          const dayMeetings = key ? (byDay.get(key) ?? []) : [];
          const count = dayMeetings.length;
          const firstTitle = dayMeetings[0]?.title ?? "";
          const preview = count ? truncate(firstTitle, 64) : "";

          return (
            <div
              key={key ?? idx}
              role="gridcell"
              className="flex min-h-0 min-w-0"
            >
              <CalendarDayCell
                dayNumber={date.getDate()}
                isToday={key !== null && key === todayKey}
                meetingCount={count}
                previewTitle={preview}
                selected={key !== null && key === selectedDateKey}
                onClick={() => {
                  if (key) onSelectDay(key, dayMeetings);
                }}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-stone-500 sm:text-sm">
        Tip: click a day to see all meetings scheduled for that date.
      </p>
    </div>
  );
}
