import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("../components/meetings/MeetingCalendar", () => ({
  default: ({ meetings, selectedDateKey, onSelectDay }) => (
    <div data-testid="meeting-calendar">
      <p>Calendar meetings: {meetings.length}</p>
      <p>Selected: {selectedDateKey ?? "none"}</p>
      <button
        type="button"
        onClick={() => onSelectDay("2026-04-12", meetings.slice(0, 1))}
      >
        Pick date
      </button>
    </div>
  ),
}));

vi.mock("../components/meetings/MeetingDetailsPanel", () => ({
  default: ({ open, dateKey, meetings, onClose }) =>
    open ? (
      <div data-testid="meeting-day-panel">
        <p>Panel day: {dateKey}</p>
        <p>Panel meetings: {meetings.length}</p>
        <button type="button" onClick={onClose}>
          Close panel
        </button>
      </div>
    ) : null,
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
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

    expect(screen.getByText("Loading meetings…")).toBeInTheDocument();
  });

  it("shows hard error fallback when detail load fails and no stokvel is available", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetchHandlers({
      detail: makeTextErrorResponse("Detail exploded"),
      meetings: makeResponse({ json: { meetings: [] } }),
    });

    renderMeetings();

    expect(await screen.findByText("Detail exploded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
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
    expect(screen.getByTestId("meeting-calendar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pick date" }));
    expect(screen.getByTestId("meeting-day-panel")).toBeInTheDocument();
    expect(screen.getByText("Panel day: 2026-04-12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    await waitFor(() =>
      expect(screen.queryByTestId("meeting-day-panel")).not.toBeInTheDocument(),
    );
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
      target: { value: "2026-04-30T10:00" },
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
      meetingDate: "2026-04-30T10:00",
      meetingLink: "https://new",
      agenda: "agenda",
    });
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
      target: { value: "2026-04-30T10:00" },
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
    vi.mocked(window.confirm).mockReturnValue(false);
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
