import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toLocalDateKey } from "../components/meetings/meetingCalendarUtils";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import Meetings from "./Meetings";

const { routerState, sessionState } = vi.hoisted(() => ({
  routerState: {
    params: { stokvel_id: "stok-1" },
    navigate: vi.fn(),
  },
  sessionState: {
    current: {
      session: { access_token: "token-123", user: { id: "user-1" } },
    },
  },
}));

const readViewCacheMock = vi.fn();
const writeViewCacheMock = vi.fn();

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => routerState.navigate,
  useParams: () => routerState.params,
}));

vi.mock("../context/SessionContext", () => ({
  useSession: () => sessionState.current,
}));

vi.mock("../utils/api", () => ({
  apiUrl: (path) => `http://test${path}`,
}));

vi.mock("../utils/viewCache", () => ({
  readViewCache: (...args) => readViewCacheMock(...args),
  writeViewCache: (...args) => writeViewCacheMock(...args),
}));

const confirmMock = vi.fn().mockResolvedValue(true);

vi.mock("../context/ModalContext", () => ({
  useConfirm: () => confirmMock,
}));

function makeResponse({ ok = true, json = {} }) {
  return {
    ok,
    text: async () => JSON.stringify(json),
  };
}

function makeTextErrorResponse(message) {
  return {
    ok: false,
    text: async () => message,
  };
}

function setupFetchHandlers({ detail, meetings, create, patch, minutes, del }) {
  global.fetch = vi.fn(async (url, options = {}) => {
    const method = options.method ?? "GET";
    const u = String(url);

    if (u.endsWith("/api/stokvels/stok-1") && method === "GET") return detail;
    if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") return meetings;
    if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "POST") return create;
    if (u.includes("/meetings/") && u.endsWith("/minutes") && method === "PATCH") return minutes;
    if (u.includes("/meetings/") && method === "PATCH") return patch;
    if (u.includes("/meetings/") && method === "DELETE") return del;
    throw new Error(`Unhandled fetch ${method} ${u}`);
  });
}

function futureIso() {
  return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
}

/** `datetime-local` string strictly in the future (local TZ), for schedule form tests */
function futureDatetimeLocal() {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` in the past (local TZ), for validation tests — avoids fake timers with findBy* */
function pastDatetimeLocal() {
  const d = new Date(Date.now() - 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pastIso() {
  return new Date(Date.now() - 24 * 3600 * 1000).toISOString();
}

function renderMeetings() {
  return render(<Meetings />);
}

const baseMembers = [{ user_id: "user-1", group_role: "treasurer" }];
const baseDetail = {
  membership: { group_role: "member", stokvels: { name: "Fallback Group" } },
  stokvel: { id: "stok-1", name: "Alpha Group" },
  members: baseMembers,
  totalContribution: 1000,
  contributions: [],
};

const meetingUpcoming = {
  id: "m-up",
  title: "Planning Session",
  meeting_date: futureIso(),
  meeting_link: "https://meet.example.com/up",
  agenda: "- Review contributions",
  minutes: "",
};

const meetingPast = {
  id: "m-past",
  title: "Last Session",
  meeting_date: pastIso(),
  meeting_link: "",
  agenda: "",
  notes: "Legacy notes",
  minutes: "Done minutes",
};

describe("Meetings page", () => {
  beforeEach(() => {
    routerState.params = { stokvel_id: "stok-1" };
    routerState.navigate.mockReset();
    sessionState.current = {
      session: { access_token: "token-123", user: { id: "user-1" } },
    };
    readViewCacheMock.mockReset();
    writeViewCacheMock.mockReset();
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to dashboard and renders null when stokvel_id is missing", async () => {
    routerState.params = {};
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [] } }),
    });

    const { container } = renderMeetings();

    expect(container.firstChild).toBeNull();
    await waitFor(() =>
      expect(routerState.navigate).toHaveBeenCalledWith("/dashboard", { replace: true }),
    );
  });

  it("shows loading skeleton when fetch is in progress", () => {
    global.fetch = vi.fn(
      () =>
        new Promise(() => {
          /* intentionally pending */
        }),
    );
    readViewCacheMock.mockReturnValue(null);

    renderMeetings();

    expect(screen.getByRole("heading", { name: "Meetings" })).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows hard error fallback when detail load fails and no stokvel is available", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeTextErrorResponse("Detail exploded"),
      meetings: makeResponse({ json: { meetings: [] } }),
    });

    renderMeetings();

    expect(await screen.findByText("Detail exploded")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to dashboard" })).not.toBeInTheDocument();
  });

  it("renders upcoming and past meetings, markdown fallback labels, and role controls", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingPast, meetingUpcoming] } }),
    });

    renderMeetings();

    expect(await screen.findByText("Alpha Group")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule new meeting" })).toBeInTheDocument();
    expect(screen.getByText("Planning Session")).toBeInTheDocument();
    expect(screen.getByText("Last Session")).toBeInTheDocument();
    expect(screen.getByText("No minutes recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("Meeting link not set.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join meeting" })).toHaveAttribute(
      "href",
      "https://meet.example.com/up",
    );
    expect(screen.getByText("Meeting link not set.")).toBeInTheDocument();
  });

  it("hides management actions for non-admin/non-treasurer roles", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({
        json: { ...baseDetail, members: [{ user_id: "user-1", group_role: "member" }] },
      }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
    });

    renderMeetings();

    await screen.findByText("Planning Session");
    expect(screen.queryByRole("button", { name: "Schedule new meeting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit meeting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete meeting" })).not.toBeInTheDocument();
  });

  it("switches to calendar view and opens/closes day panel from selected date", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming, meetingPast] } }),
    });

    renderMeetings();
    await screen.findByText("Planning Session");

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));

    const calendarSection = screen.getByLabelText("Meetings calendar");
    const calendarGrid = await within(calendarSection).findByRole("grid", {
      name: "Meeting calendar",
    });
    expect(within(calendarGrid).getByText("Sun")).toBeInTheDocument();

    const upcomingKey = toLocalDateKey(meetingUpcoming.meeting_date);
    const dayButton = within(calendarGrid)
      .getByText("Planning Session")
      .closest("button");
    expect(dayButton).toBeTruthy();
    fireEvent.click(dayButton);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Planning Session")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Open full detail" }),
    ).toHaveAttribute("href", `/group/stok-1/meetings/${meetingUpcoming.id}`);
    expect(
      within(dialog).getByRole("link", { name: "Join link" }),
    ).toHaveAttribute("href", "https://meet.example.com/up");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(upcomingKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("opens schedule modal and creates meeting with trimmed fields then writes cache", async () => {
    readViewCacheMock
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ membership: baseDetail.membership, meetings: [meetingUpcoming] });

    const createdMeeting = {
      id: "m-created",
      title: "New Session",
      meeting_date: futureIso(),
      meeting_link: "https://new",
      agenda: "agenda",
      minutes: "",
    };

    const meetingDateLocal = futureDatetimeLocal();

    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
      create: makeResponse({ json: { meeting: createdMeeting } }),
    });

    renderMeetings();
    await screen.findByText("Planning Session");

    fireEvent.click(screen.getByRole("button", { name: "Schedule new meeting" }));
    fireEvent.change(screen.getByLabelText("Title *"), {
      target: { value: "  New Session  " },
    });
    fireEvent.change(screen.getByLabelText("Date & time *"), {
      target: { value: meetingDateLocal },
    });
    fireEvent.change(screen.getByLabelText("Meeting link"), {
      target: { value: "  https://new  " },
    });
    fireEvent.change(screen.getByLabelText("Agenda (optional, Markdown)"), {
      target: { value: "  agenda  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));

    expect(await screen.findByText("Meeting scheduled.")).toBeInTheDocument();
    expect(writeViewCacheMock).toHaveBeenCalled();

    const createCall = global.fetch.mock.calls.find(
      ([url, opts]) => String(url).endsWith("/api/stokvels/stok-1/meetings") && opts?.method === "POST",
    );
    const body = JSON.parse(createCall[1].body);
    expect(body).toEqual({
      title: "New Session",
      meetingDate: meetingDateLocal,
      meetingLink: "https://new",
      agenda: "agenda",
    });
  });

  it("does not submit schedule when datetime is not in the future locally", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
      create: makeResponse({ json: { meeting: { id: "x" } } }),
    });

    renderMeetings();
    await screen.findByText("Planning Session");

    const fetchCountAfterLoad = global.fetch.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Schedule new meeting" }));
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "Past meet" } });
    fireEvent.change(screen.getByLabelText("Date & time *"), {
      target: { value: pastDatetimeLocal() },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already passed/i);
    expect(global.fetch.mock.calls.length).toBe(fetchCountAfterLoad);
  });

  it("shows schedule error on create failure and allows canceling modal", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
      create: makeTextErrorResponse("Create failed"),
    });

    renderMeetings();
    await screen.findByText("Planning Session");

    fireEvent.click(screen.getByRole("button", { name: "Schedule new meeting" }));
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Date & time *"), {
      target: { value: futureDatetimeLocal() },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));
    expect(await screen.findByText("Create failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Schedule meeting" })).not.toBeInTheDocument(),
    );
  });

  it("edits and saves a meeting when confirmation passes", async () => {
    readViewCacheMock.mockReturnValue(null);
    const updated = { ...meetingUpcoming, title: "Updated title", agenda: "new agenda" };
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
      patch: makeResponse({ json: { meeting: updated } }),
    });

    renderMeetings();
    await screen.findByText("Planning Session");

    fireEvent.click(screen.getByRole("button", { name: "Edit meeting" }));
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Updated title" } });
    fireEvent.change(screen.getByPlaceholderText("Agenda (Markdown supported)"), {
      target: { value: "new agenda" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save edits" }));

    expect(await screen.findByText("Meeting updated.")).toBeInTheDocument();
    expect(await screen.findByText("Updated title")).toBeInTheDocument();
  });

  it("does not call patch when edit confirmation is rejected", async () => {
    confirmMock.mockResolvedValueOnce(false);
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
      patch: makeResponse({ json: { meeting: meetingUpcoming } }),
    });

    renderMeetings();
    await screen.findByText("Planning Session");
    fireEvent.click(screen.getByRole("button", { name: "Edit meeting" }));
    fireEvent.click(screen.getByRole("button", { name: "Save edits" }));

    const patchCalls = global.fetch.mock.calls.filter(
      ([url, opts]) => String(url).includes("/meetings/") && opts?.method === "PATCH",
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("saves minutes and handles delete flow including success messages", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
      minutes: makeResponse({ json: { meeting: { ...meetingUpcoming, minutes: "new minutes" } } }),
      del: makeResponse({ json: { ok: true } }),
    });

    renderMeetings();
    await screen.findByText("Planning Session");

    const minutesInput = screen.getAllByPlaceholderText("Record minutes… (Markdown supported)")[0];
    fireEvent.change(minutesInput, { target: { value: "new minutes" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save minutes" })[0]);
    expect(await screen.findByText("Minutes saved.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete meeting" })[0]);
    expect(await screen.findByText("Meeting deleted.")).toBeInTheDocument();
    expect(screen.queryByText("Planning Session")).not.toBeInTheDocument();
  });

  it("shows action error when saving minutes fails", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeResponse({ json: baseDetail }),
      meetings: makeResponse({ json: { meetings: [meetingUpcoming] } }),
      minutes: makeTextErrorResponse("Minutes failed"),
    });

    renderMeetings();
    await screen.findByText("Planning Session");
    fireEvent.click(screen.getByRole("button", { name: "Save minutes" }));
    expect(await screen.findByText("Minutes failed")).toBeInTheDocument();
  });
});
