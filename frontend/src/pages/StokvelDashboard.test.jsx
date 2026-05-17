import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StokvelDashboard from "./StokvelDashboard";

const { routerState, sessionState } = vi.hoisted(() => ({
  routerState: {
    params: { stokvel_id: "stok-1" },
    navigate: vi.fn(),
  },
  sessionState: {
    current: { session: { access_token: "token-1", user: { id: "u1" } } },
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

vi.mock("../components/QuickPayModal", () => ({
  default: ({ onClose, onRecordError, onSuccess, monthlyContribution }) => (
    <div data-testid="quickpay-modal">
      <button type="button" onClick={() => onRecordError("record-failed")}>
        record-error
      </button>
      <button
        type="button"
        onClick={() =>
          onSuccess(monthlyContribution, {
            id: "c100",
            amount: monthlyContribution,
            paid_at: "2026-04-20T10:00:00.000Z",
            user_id: "u1",
          })
        }
      >
        success
      </button>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

function okJson(json) {
  return { ok: true, text: async () => JSON.stringify(json) };
}

function failText(text) {
  return { ok: false, text: async () => text };
}

function setupFetch({ detailRes, meetingsRes }) {
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.endsWith("/api/stokvels/stok-1")) return detailRes;
    if (u.endsWith("/api/stokvels/stok-1/meetings")) return meetingsRes;
    throw new Error(`Unhandled fetch URL: ${u}`);
  });
}

function futureIso(days = 1) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso(days = 1) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const baseMembers = [
  { user_id: "u1", group_role: "member", profiles: { first_name: "Ada", last_name: "Lovelace" } },
  { user_id: "u2", group_role: "admin", profiles: { full_name: "Admin User" } },
  { user_id: "u3", group_role: "treasurer", profiles: { email: "treasurer@example.com" } },
];

const baseDetail = {
  membership: { group_role: "member", stokvels: { name: "Fallback Group" } },
  stokvel: { id: "stok-1", name: "Main Group", contribution_amount: 500, status: "active" },
  members: baseMembers,
  totalContribution: 1500,
  contributions: [],
};

describe("StokvelDashboard", () => {
  beforeEach(() => {
    routerState.params = { stokvel_id: "stok-1" };
    routerState.navigate.mockReset();
    sessionState.current = { session: { access_token: "token-1", user: { id: "u1" } } };
    readViewCacheMock.mockReset();
    writeViewCacheMock.mockReset();
  });

  it("redirects to dashboard when stokvel_id is missing", async () => {
    routerState.params = {};
    setupFetch({ detailRes: okJson(baseDetail), meetingsRes: okJson({ meetings: [] }) });

    const { container } = render(<StokvelDashboard />);
    expect(container.firstChild).toBeNull();
    await waitFor(() =>
      expect(routerState.navigate).toHaveBeenCalledWith("/dashboard", { replace: true }),
    );
  });

  it("shows loading state when detail fetch is pending", () => {
    readViewCacheMock.mockReturnValue(null);
    global.fetch = vi.fn(
      () =>
        new Promise(() => {
          // pending promise keeps loading visible
        }),
    );

    render(<StokvelDashboard />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows hard error page when detail request fails and no effective stokvel exists", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detailRes: failText("boom"), meetingsRes: okJson({ meetings: [] }) });

    render(<StokvelDashboard />);
    expect(await screen.findByText("boom")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back to dashboard" })).not.toBeInTheDocument();
  });

  it("renders dashboard summary cards, leadership info, and upcoming meeting", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detailRes: okJson(baseDetail),
      meetingsRes: okJson({
        meetings: [
          { id: "m-old", title: "Old", meeting_date: pastIso(2), notes: "old notes" },
          { id: "m-next", title: "Next Meeting", meeting_date: futureIso(2), agenda: "Plan payouts" },
          { id: "m-later", title: "Later", meeting_date: futureIso(5) },
        ],
      }),
    });

    render(<StokvelDashboard />);

    expect(await screen.findByText("Main Group")).toBeInTheDocument();
    expect(screen.getByText("Contributions to date")).toBeInTheDocument();
    expect(screen.getByText("Expected payout (cycle)")).toBeInTheDocument();
    expect(screen.getByText("Monthly contribution")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();

    expect(screen.getByText("Next Meeting")).toBeInTheDocument();
    expect(screen.getByText("Plan payouts")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("treasurer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All meetings" })).toHaveAttribute(
      "href",
      "/group/stok-1/meetings",
    );
  });

  it("shows meetings load warning and fallback content when no upcoming meetings", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detailRes: okJson(baseDetail),
      meetingsRes: failText("meetings unavailable"),
    });

    render(<StokvelDashboard />);
    expect(await screen.findByText(/Meetings could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText("No upcoming meetings scheduled.")).toBeInTheDocument();
  });

  it("renders inactive badge and disables quick pay for non-active stokvel", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detailRes: okJson({
        ...baseDetail,
        stokvel: { ...baseDetail.stokvel, status: "pending" },
      }),
      meetingsRes: okJson({ meetings: [] }),
    });

    render(<StokvelDashboard />);
    expect(await screen.findByText("pending")).toBeInTheDocument();
    const payBtn = screen.getByRole("button", { name: "Pay monthly contribution" });
    expect(payBtn).toBeDisabled();
    expect(screen.getByText("Payments are available when the group is active.")).toBeInTheDocument();
  });

  it("opens quick pay modal and closes", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detailRes: okJson(baseDetail), meetingsRes: okJson({ meetings: [] }) });

    render(<StokvelDashboard />);
    await screen.findByText("Main Group");
    fireEvent.click(screen.getByRole("button", { name: "Pay monthly contribution" }));
    expect(screen.getByTestId("quickpay-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close" }));
    await waitFor(() =>
      expect(screen.queryByTestId("quickpay-modal")).not.toBeInTheDocument(),
    );
  });

  it("handles quick pay record error callback without closing the modal", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detailRes: okJson(baseDetail), meetingsRes: okJson({ meetings: [] }) });

    render(<StokvelDashboard />);
    await screen.findByText("Main Group");
    fireEvent.click(screen.getByRole("button", { name: "Pay monthly contribution" }));
    fireEvent.click(screen.getByRole("button", { name: "record-error" }));
    expect(screen.getByTestId("quickpay-modal")).toBeInTheDocument();
    expect(screen.getByText("Main Group")).toBeInTheDocument();
  });

  it("handles quick pay success and updates cache when cached object exists", async () => {
    readViewCacheMock
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        membership: baseDetail.membership,
        stokvel: baseDetail.stokvel,
        members: baseMembers,
        totalContribution: 1500,
        contributions: [],
      });
    setupFetch({ detailRes: okJson(baseDetail), meetingsRes: okJson({ meetings: [] }) });

    render(<StokvelDashboard />);
    await screen.findByText("Main Group");
    fireEvent.click(screen.getByRole("button", { name: "Pay monthly contribution" }));
    fireEvent.click(screen.getByRole("button", { name: "success" }));

    await waitFor(() =>
      expect(screen.queryByTestId("quickpay-modal")).not.toBeInTheDocument(),
    );
    expect(writeViewCacheMock).toHaveBeenCalled();
  });

  it("uses cached data immediately while still refreshing from API", async () => {
    readViewCacheMock.mockReturnValue({
      membership: { group_role: "member", stokvels: { name: "Cached Name" } },
      stokvel: { id: "stok-1", name: "Cached Name", contribution_amount: 250, status: "active" },
      members: [{ user_id: "u1", group_role: "member", profiles: { full_name: "Cached User" } }],
      totalContribution: 999,
      meetings: [{ id: "m-cache", title: "Cached Meeting", meeting_date: futureIso(1) }],
    });
    setupFetch({ detailRes: okJson(baseDetail), meetingsRes: okJson({ meetings: [] }) });

    render(<StokvelDashboard />);
    expect(await screen.findByText("Cached Name")).toBeInTheDocument();
    await screen.findByText("Main Group");
  });
});
