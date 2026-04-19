/**
 * Helpers for the meetings calendar (local browser dates, same as `new Date(meeting_date)` elsewhere).
 * Keeps grouping logic out of UI components so wiring to the API stays a one-liner later.
 */

/** @param {string | Date} value */
export function toLocalDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Same formatting as the meetings list (`Meetings.jsx`). */
export function toDisplayMeetingDate(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * @param {number} year
 * @param {number} monthIndex 0–11
 * @returns {{ type: 'empty' } | { type: 'day', date: Date }}[]
 */
export function buildMonthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  /** @type {{ type: 'empty' } | { type: 'day', date: Date }}[] */
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push({ type: "empty" });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ type: "day", date: new Date(year, monthIndex, day) });
  }
  while (cells.length % 7 !== 0) cells.push({ type: "empty" });
  return cells;
}

/**
 * @param {Array<{ meeting_date: string, id?: string }>} meetings
 * @returns {Map<string, object[]>}
 */
export function groupMeetingsByLocalDateKey(meetings) {
  const map = new Map();
  for (const m of meetings) {
    const key = toLocalDateKey(m.meeting_date);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort(
      (a, b) =>
        new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime(),
    );
  }
  return map;
}
