import { useEffect } from "react";
import { Link } from "react-router-dom";
import { btnSecondary, cardLight } from "../../ui";
import { toDisplayMeetingDate } from "./meetingCalendarUtils";

/** Readable heading from YYYY-MM-DD */
function formatDateHeading(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return "Meetings";
  const [y, mo, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return "Meetings";
  return dt.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Modal listing all meetings on the chosen calendar day (links to existing detail route).
 */
export default function MeetingDetailsPanel({
  open,
  dateKey,
  meetings,
  meetingBase,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(ev) {
      if (ev.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      {/* Backdrop closes on click; dialog is a sibling so clicks inside do not hit this layer */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-stone-900/40 backdrop-blur-[1px]"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meeting-day-panel-title"
        className={`relative z-10 w-full max-w-md ${cardLight} max-h-[85vh] overflow-y-auto border border-stone-200 p-4 shadow-lg dark:border-slate-700 sm:p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2
            id="meeting-day-panel-title"
            className="text-lg font-bold text-emerald-800 dark:text-emerald-300"
          >
            {formatDateHeading(dateKey)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-slate-800 dark:hover:text-stone-100"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" aria-hidden />
          </button>
        </div>

        {meetings.length === 0 ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">No meetings on this day.</p>
        ) : (
          <ul className="space-y-3">
            {meetings.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <p className="font-semibold text-stone-800 dark:text-stone-100">{m.title || "Meeting"}</p>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {toDisplayMeetingDate(m.meeting_date)}
                </p>
                {m.agenda || m.notes ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                    {m.agenda || m.notes}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to={`${meetingBase}/${m.id}`}
                    className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                  >
                    Open full detail
                  </Link>
                  {m.meeting_link ? (
                    <a
                      href={m.meeting_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
                    >
                      Join link
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
