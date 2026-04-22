const DATETIME_LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Parses a `datetime-local` value (YYYY-MM-DDTHH:mm) as an instant in the user's local timezone.
 * @param {string} value
 * @returns {Date | null}
 */
export function meetingDatetimeLocalToDate(value) {
  if (!value || typeof value !== "string") return null;
  const m = DATETIME_LOCAL_RE.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const h = Number(m[4]);
  const min = Number(m[5]);
  if ([y, mo, d, h, min].some((n) => Number.isNaN(n))) return null;
  const dt = new Date(y, mo, d, h, min, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo ||
    dt.getDate() !== d ||
    dt.getHours() !== h ||
    dt.getMinutes() !== min
  ) {
    return null;
  }
  return dt;
}

/** Shown when the chosen local instant is not strictly after the current time. */
export const MEETING_SCHEDULE_NOT_FUTURE_ERROR =
  "That date and time has already passed. Pick a future date and time to schedule the meeting.";

/**
 * @param {string} meetingDatetimeLocal
 * @returns {{ ok: true } | { ok: false; message: string }}
 */
export function validateMeetingScheduleLocal(meetingDatetimeLocal) {
  const proposed = meetingDatetimeLocalToDate(meetingDatetimeLocal);
  if (!proposed) {
    return { ok: false, message: "Invalid date and time." };
  }
  if (proposed.getTime() <= Date.now()) {
    return { ok: false, message: MEETING_SCHEDULE_NOT_FUTURE_ERROR };
  }
  return { ok: true };
}
