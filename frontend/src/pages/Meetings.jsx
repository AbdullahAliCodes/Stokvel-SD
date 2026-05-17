import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useSession } from "../context/SessionContext";
import { apiUrl } from "../utils/api";
import {
  btnPrimary,
  btnSecondary,
  cardLight,
  errorBox,
  inputLight,
  pageSubtitle,
} from "../ui";
import { readViewCache, writeViewCache } from "../utils/viewCache";
import { validateMeetingScheduleLocal } from "../utils/meetingScheduleValidation";
import MeetingCalendar from "../components/meetings/MeetingCalendar";
import MeetingDetailsPanel from "../components/meetings/MeetingDetailsPanel";

function parseApiError(text) {
  try {
    const json = JSON.parse(text);
    return json.error || text || "Request failed";
  } catch {
    return text || "Request failed";
  }
}

function confirmAction(message) {
  return window.confirm(message);
}

function toDatetimeLocalValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDisplayDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

const markdownBody =
  "text-sm leading-relaxed text-stone-700 dark:text-stone-300 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_a]:text-emerald-800 [&_a]:underline dark:[&_a]:text-emerald-300 [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1 [&_code]:text-xs dark:[&_code]:bg-slate-800";

function MarkdownBlock({ text, emptyLabel }) {
  const src = (text || "").trim();
  if (!src) {
    return <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{emptyLabel}</p>;
  }
  return (
    <div className={markdownBody}>
      <ReactMarkdown>{src}</ReactMarkdown>
    </div>
  );
}

export default function Meetings() {
  const { stokvel_id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stokvel, setStokvel] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [meetingsError, setMeetingsError] = useState("");
  const [meetingSaving, setMeetingSaving] = useState(false);
  const [meetingActionError, setMeetingActionError] = useState("");
  const [meetingActionOk, setMeetingActionOk] = useState("");
  const [editingMeetingId, setEditingMeetingId] = useState("");
  const [editDraft, setEditDraft] = useState({});
  const [minutesDraft, setMinutesDraft] = useState({});
  const [meetingsTab, setMeetingsTab] = useState(
    /** @type {'list' | 'calendar'} */ ("list"),
  );
  /** `{ dateKey, meetings }` when a calendar day is selected */
  const [dayPanel, setDayPanel] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    meetingDate: "",
    meetingLink: "",
    agenda: "",
  });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  /** Bumped on schedule submit errors so the alert replay its shake animation */
  const [scheduleErrorShakeKey, setScheduleErrorShakeKey] = useState(0);

  useEffect(() => {
    if (!stokvel_id) {
      navigate("/dashboard", { replace: true });
      return;
    }
    if (!session?.access_token || !session?.user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const id = stokvel_id;
    const cacheKey = `stokvel_detail:${session.user.id}:${id}`;

    async function load() {
      setLoading(true);
      setError(null);
      setMeetingsError("");
      const cached = readViewCache(cacheKey, 120000);
      if (cached && !cancelled) {
        setMembership(cached.membership ?? null);
        setStokvel(cached.stokvel ?? null);
        setMembers(Array.isArray(cached.members) ? cached.members : []);
        setMeetings(Array.isArray(cached.meetings) ? cached.meetings : []);
        setLoading(false);
      }

      try {
        const [res, meetingsRes] = await Promise.all([
          fetch(apiUrl(`/api/stokvels/${id}`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(apiUrl(`/api/stokvels/${id}/meetings`), {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);
        const [text, meetingsText] = await Promise.all([
          res.text(),
          meetingsRes.text(),
        ]);
        if (!res.ok) throw new Error(parseApiError(text));
        if (!meetingsRes.ok) throw new Error(parseApiError(meetingsText));
        const json = JSON.parse(text);
        const meetingsJson = JSON.parse(meetingsText);
        if (cancelled) return;
        setMembership(json.membership ?? null);
        setStokvel(json.stokvel ?? null);
        const nextMembers = Array.isArray(json.members) ? json.members : [];
        setMembers(nextMembers);
        const nextMeetings = Array.isArray(meetingsJson.meetings)
          ? meetingsJson.meetings
          : [];
        setMeetings(nextMeetings);
        const prev = readViewCache(cacheKey, 120000);
        writeViewCache(cacheKey, {
          membership: json.membership ?? null,
          stokvel: json.stokvel ?? null,
          members: nextMembers,
          totalContribution: Number(
            json.totalContribution ?? prev?.totalContribution ?? 0,
          ),
          contributions: Array.isArray(json.contributions)
            ? json.contributions
            : Array.isArray(prev?.contributions)
              ? prev.contributions
              : [],
          meetings: nextMeetings,
        });
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e));
          setMeetingsError(e.message ?? String(e));
          setStokvel(null);
          setMembership(null);
          setMembers([]);
          setMeetings([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [session, stokvel_id, navigate]);

  const effectiveStokvel = stokvel ?? membership?.stokvels ?? null;
  const groupName = effectiveStokvel?.name ?? "This group";
  const myGroupRole =
    members.find((m) => m.user_id === session?.user?.id)?.group_role ||
    membership?.group_role;
  const canManageMeetings = ["treasurer", "admin"].includes(
    String(myGroupRole || "").toLowerCase(),
  );

  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const nowTs = Date.now();
    const upcoming = meetings.filter(
      (m) => new Date(m.meeting_date).getTime() >= nowTs,
    );
    const past = meetings.filter(
      (m) => new Date(m.meeting_date).getTime() < nowTs,
    );
    upcoming.sort(
      (a, b) =>
        new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime(),
    );
    past.sort(
      (a, b) =>
        new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime(),
    );
    return { upcomingMeetings: upcoming, pastMeetings: past };
  }, [meetings]);

  const meetingBase = stokvel_id
    ? `/group/${stokvel_id}/meetings`
    : "/dashboard";

  function openEdit(meeting) {
    setEditingMeetingId(meeting.id);
    setEditDraft({
      title: meeting.title ?? "",
      meetingDate: toDatetimeLocalValue(meeting.meeting_date),
      meetingLink: meeting.meeting_link ?? "",
      agenda: meeting.agenda ?? meeting.notes ?? "",
    });
    setMinutesDraft((prev) => ({
      ...prev,
      [meeting.id]: meeting.minutes ?? "",
    }));
  }

  async function handleSaveMeeting(meetingId) {
    if (!session?.access_token || !stokvel_id) return;
    if (!confirmAction("Save edits to this meeting?")) return;
    setMeetingSaving(true);
    setMeetingActionError("");
    setMeetingActionOk("");
    try {
      const res = await fetch(
        apiUrl(`/api/stokvels/${stokvel_id}/meetings/${meetingId}`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(editDraft),
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      const data = JSON.parse(text);
      if (data.meeting) {
        setMeetings((prev) =>
          prev
            .map((m) => (m.id === meetingId ? data.meeting : m))
            .sort(
              (a, b) =>
                new Date(a.meeting_date).getTime() -
                new Date(b.meeting_date).getTime(),
            ),
        );
      }
      setEditingMeetingId("");
      setEditDraft({});
      setMeetingActionOk("Meeting updated.");
    } catch (e) {
      setMeetingActionError(e.message ?? String(e));
    } finally {
      setMeetingSaving(false);
    }
  }

  async function handleSaveMinutes(meetingId) {
    if (!session?.access_token || !stokvel_id) return;
    if (!confirmAction("Save minutes for this meeting?")) return;
    setMeetingSaving(true);
    setMeetingActionError("");
    setMeetingActionOk("");
    try {
      const res = await fetch(
        apiUrl(`/api/stokvels/${stokvel_id}/meetings/${meetingId}/minutes`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ minutes: minutesDraft[meetingId] ?? "" }),
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      const data = JSON.parse(text);
      if (data.meeting) {
        setMeetings((prev) =>
          prev.map((m) => (m.id === meetingId ? data.meeting : m)),
        );
      }
      setMeetingActionOk("Minutes saved.");
    } catch (e) {
      setMeetingActionError(e.message ?? String(e));
    } finally {
      setMeetingSaving(false);
    }
  }

  async function handleCreateMeeting(e) {
    e.preventDefault();
    if (!session?.access_token || !stokvel_id) return;
    setScheduleError("");
    setMeetingActionError("");
    setMeetingActionOk("");
    const scheduleCheck = validateMeetingScheduleLocal(scheduleForm.meetingDate);
    if (!scheduleCheck.ok) {
      setScheduleError(scheduleCheck.message);
      setScheduleErrorShakeKey((k) => k + 1);
      return;
    }
    setScheduleSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/stokvels/${stokvel_id}/meetings`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: scheduleForm.title.trim(),
          meetingDate: scheduleForm.meetingDate,
          meetingLink: scheduleForm.meetingLink.trim(),
          agenda: scheduleForm.agenda.trim(),
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      const data = JSON.parse(text);
      const created = data.meeting;
      if (created) {
        const cacheKey = `stokvel_detail:${session.user.id}:${stokvel_id}`;
        setMeetings((prev) => {
          const next = [...prev, created].sort(
            (a, b) =>
              new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime(),
          );
          const prevCache = readViewCache(cacheKey, 120000);
          writeViewCache(cacheKey, {
            ...(typeof prevCache === "object" && prevCache ? prevCache : {}),
            meetings: next,
          });
          return next;
        });
      }
      setScheduleOpen(false);
      setScheduleForm({ title: "", meetingDate: "", meetingLink: "", agenda: "" });
      setMeetingActionOk("Meeting scheduled.");
    } catch (err) {
      setScheduleError(err.message ?? String(err));
      setScheduleErrorShakeKey((k) => k + 1);
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleDeleteMeeting(meetingId) {
    if (!session?.access_token || !stokvel_id) return;
    if (!confirmAction("Delete this meeting? This cannot be undone.")) return;
    setMeetingSaving(true);
    setMeetingActionError("");
    setMeetingActionOk("");
    try {
      const res = await fetch(
        apiUrl(`/api/stokvels/${stokvel_id}/meetings/${meetingId}`),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const text = await res.text();
      if (!res.ok) throw new Error(parseApiError(text));
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      setMeetingActionOk("Meeting deleted.");
    } catch (e) {
      setMeetingActionError(e.message ?? String(e));
    } finally {
      setMeetingSaving(false);
    }
  }

  if (!stokvel_id) return null;

  if (loading && !stokvel && !error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-stone-500 dark:text-stone-400">
        Loading meetings…
      </div>
    );
  }

  if (error && !effectiveStokvel) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold text-emerald-800 dark:text-emerald-300">Meetings</h1>
        <p className={errorBox}>{error}</p>
      </div>
    );
  }

  function renderMeetingCard(meeting, { isPast }) {
    return (
      <div
        key={meeting.id}
        className={`${cardLight} space-y-3 border border-stone-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 pb-2 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-stone-800 dark:text-stone-100">{meeting.title}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {toDisplayDate(meeting.meeting_date)}
            </p>
          </div>
          <Link
            to={`${meetingBase}/${meeting.id}`}
            className="shrink-0 text-xs font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
          >
            Open detail
          </Link>
        </div>

        {editingMeetingId === meeting.id ? (
          <div className="space-y-2 rounded-lg bg-stone-50/80 p-3 dark:bg-slate-800/60">
            <input
              type="text"
              value={editDraft.title ?? ""}
              onChange={(e) =>
                setEditDraft((prev) => ({ ...prev, title: e.target.value }))
              }
              className={inputLight}
              placeholder="Title"
            />
            <input
              type="datetime-local"
              value={editDraft.meetingDate ?? ""}
              onChange={(e) =>
                setEditDraft((prev) => ({
                  ...prev,
                  meetingDate: e.target.value,
                }))
              }
              className={inputLight}
            />
            <input
              type="url"
              value={editDraft.meetingLink ?? ""}
              onChange={(e) =>
                setEditDraft((prev) => ({
                  ...prev,
                  meetingLink: e.target.value,
                }))
              }
              className={inputLight}
              placeholder="Meeting link"
            />
            <textarea
              rows={3}
              value={editDraft.agenda ?? ""}
              onChange={(e) =>
                setEditDraft((prev) => ({ ...prev, agenda: e.target.value }))
              }
              className={inputLight}
              placeholder="Agenda (Markdown supported)"
            />
            <p className="text-[11px] text-stone-500 dark:text-stone-400">Markdown is supported for agenda and minutes.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSaveMeeting(meeting.id)}
                className={btnPrimary}
                disabled={meetingSaving}
              >
                Save edits
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingMeetingId("");
                  setEditDraft({});
                }}
                className={btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Agenda
              </p>
              <MarkdownBlock
                text={meeting.agenda || meeting.notes}
                emptyLabel="No agenda yet."
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Minutes
              </p>
              <MarkdownBlock text={meeting.minutes} emptyLabel="No minutes recorded yet." />
            </div>
            {meeting.meeting_link ? (
              <a
                href={meeting.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
              >
                {isPast ? "Open meeting link" : "Join meeting"}
              </a>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400">Meeting link not set.</p>
            )}
            {canManageMeetings ? (
              <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => openEdit(meeting)}
                  className={btnSecondary}
                >
                  Edit meeting
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMeeting(meeting.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/50"
                  disabled={meetingSaving}
                >
                  Delete meeting
                </button>
                <label className="block text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                  Update minutes
                  <textarea
                    rows={3}
                    value={minutesDraft[meeting.id] ?? meeting.minutes ?? ""}
                    onChange={(e) =>
                      setMinutesDraft((prev) => ({
                        ...prev,
                        [meeting.id]: e.target.value,
                      }))
                    }
                    placeholder="Record minutes… (Markdown supported)"
                    className={`${inputLight} mt-1`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleSaveMinutes(meeting.id)}
                  className={btnPrimary}
                  disabled={meetingSaving}
                >
                  Save minutes
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 border-b border-stone-200 pb-4 dark:border-slate-700 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300 sm:text-3xl">
            <i
              className="fa-solid fa-calendar-days text-emerald-700"
              aria-hidden
            />
            Meetings
          </h1>
          <p className={`${pageSubtitle} text-stone-600 dark:text-stone-300`}>
            <span className="font-medium text-stone-800 dark:text-stone-100">{groupName}</span> —
            upcoming and past sessions. Agenda and minutes render as Markdown on each card.
          </p>
        </div>
        {canManageMeetings ? (
          <button
            type="button"
            onClick={() => {
              setScheduleError("");
              setScheduleForm({ title: "", meetingDate: "", meetingLink: "", agenda: "" });
              setScheduleOpen(true);
            }}
            className={`${btnPrimary} shrink-0`}
          >
            Schedule new meeting
          </button>
        ) : null}
      </header>

      <div className={`${cardLight} overflow-hidden border border-stone-200 dark:border-slate-700`}>
        <nav
          className="flex border-b border-stone-200 bg-stone-50/90 dark:border-slate-700 dark:bg-slate-800/70"
          aria-label="Meetings view"
        >
          <button
            type="button"
            onClick={() => {
              setMeetingsTab("list");
              setDayPanel(null);
            }}
            className={`relative flex-1 px-3 py-3 text-sm font-medium transition-colors duration-200 sm:px-4 sm:text-base ${
              meetingsTab === "list"
                ? "border-b-2 border-emerald-700 bg-emerald-50/70 text-emerald-800"
                : "border-b-2 border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-slate-800 dark:hover:text-stone-100"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setMeetingsTab("calendar")}
            className={`relative flex-1 px-3 py-3 text-sm font-medium transition-colors duration-200 sm:px-4 sm:text-base ${
              meetingsTab === "calendar"
                ? "border-b-2 border-emerald-700 bg-emerald-50/70 text-emerald-800"
                : "border-b-2 border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-slate-800 dark:hover:text-stone-100"
            }`}
          >
            Calendar
          </button>
        </nav>
      </div>
      {scheduleOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-meeting-title"
        >
          <div
            className={`${cardLight} max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-lg`}
          >
            <h2
              id="schedule-meeting-title"
              className="mb-4 text-lg font-bold text-emerald-800 dark:text-emerald-300"
            >
              Schedule meeting
            </h2>
            <form className="space-y-3" onSubmit={handleCreateMeeting}>
              <label className="block text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                Title *
                <input
                  type="text"
                  required
                  value={scheduleForm.title}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, title: e.target.value }))
                  }
                  className={`${inputLight} mt-1`}
                  placeholder="e.g. April check-in"
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                Date &amp; time *
                <input
                  type="datetime-local"
                  required
                  value={scheduleForm.meetingDate}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, meetingDate: e.target.value }))
                  }
                  aria-invalid={Boolean(scheduleError)}
                  className={`${inputLight} mt-1 transition-shadow duration-200 ${
                    scheduleError && scheduleErrorShakeKey
                      ? "ring-2 ring-red-500/70 ring-offset-2 ring-offset-stone-50 dark:ring-offset-slate-900"
                      : ""
                  }`}
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                Meeting link
                <input
                  type="url"
                  value={scheduleForm.meetingLink}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, meetingLink: e.target.value }))
                  }
                  className={`${inputLight} mt-1`}
                  placeholder="https://…"
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
                Agenda (optional, Markdown)
                <textarea
                  rows={4}
                  value={scheduleForm.agenda}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, agenda: e.target.value }))
                  }
                  className={`${inputLight} mt-1`}
                  placeholder={"- Welcome\n- Contributions review"}
                />
              </label>
              {scheduleError ? (
                <p
                  key={scheduleErrorShakeKey}
                  className={`text-sm ${errorBox} animate-meeting-schedule-shake`}
                  role="alert"
                >
                  {scheduleError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" className={btnPrimary} disabled={scheduleSaving}>
                  {scheduleSaving ? "Saving…" : "Create meeting"}
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={scheduleSaving}
                  onClick={() => setScheduleOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {meetingsError && meetings.length === 0 ? (
        <p className={`text-sm ${errorBox}`}>{meetingsError}</p>
      ) : null}
      {meetingActionError ? (
        <p className={`text-sm ${errorBox}`}>{meetingActionError}</p>
      ) : null}
      {meetingActionOk ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
          {meetingActionOk}
        </p>
      ) : null}

      {meetingsTab === "list" ? (
        <>
          <section>
            <h2 className="mb-4 text-lg font-bold text-emerald-800 dark:text-emerald-300">
              Upcoming meetings
            </h2>
            {loading && meetings.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">Loading…</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingMeetings.map((m) =>
                  renderMeetingCard(m, { isPast: false }),
                )}
                {upcomingMeetings.length === 0 ? (
                  <div
                    className={`${cardLight} border border-dashed border-stone-200 bg-stone-50/80 p-8 text-center text-sm text-stone-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-stone-300`}
                  >
                    No upcoming meetings scheduled for this group.
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-bold text-emerald-800 dark:text-emerald-300">
              Past meetings
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {pastMeetings.map((m) => renderMeetingCard(m, { isPast: true }))}
              {pastMeetings.length === 0 ? (
                <div
                  className={`${cardLight} border border-dashed border-stone-200 bg-stone-50/80 p-8 text-center text-sm text-stone-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-stone-300`}
                >
                  No past meetings yet.
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : (
        <section aria-label="Meetings calendar">
          {loading && meetings.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Loading calendar…</p>
          ) : (
            <MeetingCalendar
              meetings={meetings}
              selectedDateKey={dayPanel?.dateKey ?? null}
              onSelectDay={(dateKey, dayMeetings) =>
                setDayPanel({ dateKey, meetings: dayMeetings })
              }
            />
          )}
        </section>
      )}

      <MeetingDetailsPanel
        open={Boolean(dayPanel)}
        dateKey={dayPanel?.dateKey ?? ""}
        meetings={dayPanel?.meetings ?? []}
        meetingBase={meetingBase}
        onClose={() => setDayPanel(null)}
      />
    </div>
  );
}
