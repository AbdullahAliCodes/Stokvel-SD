import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Payments from "./Payments";

const { routerState, sessionState } = vi.hoisted(() => ({
  routerState: { params: { stokvel_id: "stok-1" } },
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
  useParams: () => routerState.params,
}));

vi.mock("../context/SessionContext", () => ({
  useSession: () => sessionState.current,
}));

const confirmMock = vi.fn().mockResolvedValue(true);

vi.mock("../context/ModalContext", () => ({
  useConfirm: () => confirmMock,
}));

vi.mock("../utils/api", () => ({
  apiUrl: (path) => `http://test${path}`,
}));

vi.mock("../utils/viewCache", () => ({
  readViewCache: (...args) => readViewCacheMock(...args),
  writeViewCache: (...args) => writeViewCacheMock(...args),
}));

vi.mock("../components/MarketRatesWidget", () => ({
  default: ({ memberMonthlyContribution }) => (
    <div data-testid="rates-widget">Rates:{memberMonthlyContribution}</div>
  ),
}));

vi.mock("../components/ReportExportActions", () => ({
  default: () => (
    <div data-testid="report-export-actions">
      <button type="button">CSV</button>
      <button type="button">PDF</button>
    </div>
  ),
}));

vi.mock("../components/QuickPayModal", () => ({
  default: ({ onClose, onSuccess, onRecordError, monthlyContribution }) => (
    <div data-testid="quickpay-modal">
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
      <button type="button" onClick={() => onRecordError("record failed")}>
        record-error
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

function setupFetch({
  detail,
  meetings,
  treasurerPatch,
  approvalPatch,
  treasurerPayouts,
  payoutOrderPatch,
  missedPaymentPost,
} = {}) {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const method = opts.method ?? "GET";
    const u = String(url);
    if (u.endsWith("/api/stokvels/stok-1") && method === "GET") return detail;
    if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") return meetings;
    if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET") {
      return treasurerPayouts ?? okJson({ payouts: [] });
    }
    if (u.endsWith("/api/stokvels/stok-1/treasurer") && method === "PATCH") return treasurerPatch;
    if (u.endsWith("/api/stokvels/stok-1/payout-order") && method === "PATCH") {
      return payoutOrderPatch ?? okJson({ success: true });
    }
    if (u.endsWith("/api/stokvels/stok-1/missed-payments") && method === "POST") {
      return missedPaymentPost ?? okJson({ success: true });
    }
    if (u.includes("/api/stokvels/stok-1/payouts/") && method === "POST") {
      return okJson({ success: true, payout: { status: "completed" } });
    }
    if (u.includes("/contributions/") && u.endsWith("/treasurer-approval") && method === "PATCH") {
      return approvalPatch ?? okJson({ success: true, contribution: {} });
    }
    throw new Error(`Unhandled fetch ${method} ${u}`);
  });
}

const members = [
  { user_id: "u1", group_role: "member", profiles: { first_name: "Ada", last_name: "L" } },
  { user_id: "u2", group_role: "treasurer", profiles: { email: "john@example.com" } },
];

const detailBase = {
  membership: { group_role: "member", stokvels: { name: "Fallback Group" } },
  stokvel: { id: "stok-1", name: "Main Group", status: "active", contribution_amount: 500, type: "Fixed" },
  members,
  totalContribution: 2000,
  contributions: [
    {
      id: "c1",
      amount: 500,
      paid_at: "2026-04-20",
      user_id: "u1",
      target_month: "2026-03",
      treasurer_approval_status: "pending",
      profiles: { full_name: "Ada L" },
    },
  ],
  currentCycle: { targetMonth: "2026-04", inPaymentWindow: true },
  payouts: [],
  missedPayments: [],
};

function renderPayments() {
  return render(<Payments />);
}

describe("Payments", () => {
  beforeEach(() => {
    routerState.params = { stokvel_id: "stok-1" };
    sessionState.current = { session: { access_token: "token-1", user: { id: "u1" } } };
    readViewCacheMock.mockReset();
    writeViewCacheMock.mockReset();
    confirmMock.mockReset();
    confirmMock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when stokvel_id is missing", () => {
    routerState.params = {};
    setupFetch({ detail: okJson(detailBase), meetings: okJson({ meetings: [] }) });

    const { container } = renderPayments();
    expect(container.firstChild).toBeNull();
  });

  it("shows sign-in message when session is missing", () => {
    sessionState.current = { session: null };
    setupFetch({ detail: okJson(detailBase), meetings: okJson({ meetings: [] }) });

    renderPayments();
    expect(screen.getByText("Sign in to view this stokvel.")).toBeInTheDocument();
  });

  it("renders loaded finance dashboard with stats, tables and widgets", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detailBase), meetings: okJson({ meetings: [{ id: "m1" }] }) });

    renderPayments();

    expect(await screen.findByText("Payments & finances")).toBeInTheDocument();
    expect(screen.getByText("Main Group")).toBeInTheDocument();
    expect(screen.getByText("Current treasurer")).toBeInTheDocument();
    expect(screen.getAllByText("john").length).toBeGreaterThan(0);
    expect(screen.getByTestId("rates-widget")).toHaveTextContent("Rates:500");
    expect(screen.getByText("Cycle ledger")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /approved/i })).toBeInTheDocument();
    expect(screen.getByText("Payout schedule")).toBeInTheDocument();
    expect(screen.getAllByText("Ada L").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "CSV" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "PDF" }).length).toBeGreaterThan(0);
  });

  it("shows empty table messages when contributions and members are empty", async () => {
    const detail = { ...detailBase, members: [], contributions: [] };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detail), meetings: okJson({ meetings: [] }) });

    renderPayments();

    await screen.findByText("No contribution cycles recorded yet.");
    expect(screen.getByText("No payout schedule yet.")).toBeInTheDocument();
  });

  it("renders pending and rejected status banners", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson({
        ...detailBase,
        stokvel: { ...detailBase.stokvel, status: "pending" },
      }),
      meetings: okJson({ meetings: [] }),
    });
    renderPayments();
    expect(await screen.findByText("Awaiting approval.")).toBeInTheDocument();

    setupFetch({
      detail: okJson({
        ...detailBase,
        stokvel: { ...detailBase.stokvel, status: "rejected" },
      }),
      meetings: okJson({ meetings: [] }),
    });
    renderPayments();
    expect(await screen.findByText("Application rejected.")).toBeInTheDocument();
  });

  it("opens quick pay modal, handles success, and closes after ledger reload", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detailBase), meetings: okJson({ meetings: [] }) });

    renderPayments();
    await screen.findByText("Payments & finances");

    fireEvent.click(screen.getByRole("button", { name: /Pay monthly contribution/i }));
    expect(screen.getByTestId("quickpay-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "success" }));
    await waitFor(() =>
      expect(screen.queryByTestId("quickpay-modal")).not.toBeInTheDocument(),
    );
  });

  it("shows record error from quick pay callback", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detailBase), meetings: okJson({ meetings: [] }) });

    renderPayments();
    await screen.findByText("Payments & finances");
    fireEvent.click(screen.getByRole("button", { name: /Pay monthly contribution/i }));
    fireEvent.click(screen.getByRole("button", { name: "record-error" }));

    expect(await screen.findByText(/Payment succeeded, but contribution was not recorded/)).toBeInTheDocument();
  });

  it("disables quick pay when stokvel is not active", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson({
        ...detailBase,
        stokvel: { ...detailBase.stokvel, status: "pending" },
      }),
      meetings: okJson({ meetings: [] }),
    });

    renderPayments();
    const quickPayBtn = await screen.findByRole("button", { name: /Pay monthly contribution/i });
    expect(quickPayBtn).toBeDisabled();
  });

  it("shows and saves treasurer assignment for manager roles", async () => {
    const detail = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "admin" },
      members: [
        { user_id: "u1", group_role: "admin", profiles: { full_name: "Admin One" } },
        { user_id: "u2", group_role: "member", profiles: { full_name: "Member Two" } },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detail),
      meetings: okJson({ meetings: [] }),
      treasurerPatch: okJson({ ok: true }),
    });

    renderPayments();
    await screen.findByText("Assign treasurer");

    fireEvent.change(screen.getByLabelText("Treasurer member"), { target: { value: "u2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save treasurer" }));

    expect(await screen.findByText("Treasurer updated.")).toBeInTheDocument();
  });

  it("shows treasurer save error and respects cancel confirmation", async () => {
    const detail = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "admin" },
      members: [
        { user_id: "u1", group_role: "admin", profiles: { full_name: "Admin One" } },
        { user_id: "u2", group_role: "member", profiles: { full_name: "Member Two" } },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detail),
      meetings: okJson({ meetings: [] }),
      treasurerPatch: failText('{"error":"Patch failed"}'),
    });

    renderPayments();
    await screen.findByText("Assign treasurer");

    fireEvent.change(screen.getByLabelText("Treasurer member"), { target: { value: "u2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save treasurer" }));
    expect(await screen.findByText("Patch failed")).toBeInTheDocument();

    confirmMock.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole("button", { name: "Save treasurer" }));
    const patchCalls = global.fetch.mock.calls.filter(
      ([u, o]) => String(u).endsWith("/treasurer") && o?.method === "PATCH",
    );
    expect(patchCalls).toHaveLength(1);
  });

  it("treasurer sees approve buttons for paid pending contribution; member does not", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
    };
    const detailAfterApproval = {
      ...detailTreasurer,
      contributions: [{ ...detailTreasurer.contributions[0], treasurer_approval_status: "approved" }],
    };
    readViewCacheMock.mockReturnValue(null);
    let approvalDone = false;
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") {
        return okJson(approvalDone ? detailAfterApproval : detailTreasurer);
      }
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") return okJson({ meetings: [] });
      if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET") return okJson({ payouts: [] });
      if (u.includes("/contributions/") && u.endsWith("/treasurer-approval") && method === "PATCH") {
        approvalDone = true;
        return okJson({ success: true, contribution: {} });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    const approveBtn = screen.getByRole("button", { name: /approve payment for ada l/i });
    expect(approveBtn).toBeInTheDocument();
    fireEvent.click(approveBtn);
    expect(await screen.findByText("Payment marked as approved.")).toBeInTheDocument();

    sessionState.current = { session: { access_token: "token-1", user: { id: "u1" } } };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detailBase), meetings: okJson({ meetings: [] }) });
    renderPayments();
    await screen.findByText("Cycle ledger");
    expect(screen.queryByRole("button", { name: /approve payment/i })).not.toBeInTheDocument();
  });

  it("treasurer can reset an approved contribution to pending", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
    };
    const approvedDetail = {
      ...detailTreasurer,
      contributions: [{ ...detailTreasurer.contributions[0], treasurer_approval_status: "approved" }],
    };
    const pendingAgain = {
      ...detailTreasurer,
      contributions: [{ ...detailTreasurer.contributions[0], treasurer_approval_status: "pending" }],
    };
    readViewCacheMock.mockReturnValue(null);
    let afterReset = false;
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") {
        return okJson(afterReset ? pendingAgain : approvedDetail);
      }
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") return okJson({ meetings: [] });
      if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET") return okJson({ payouts: [] });
      if (u.includes("/contributions/") && u.endsWith("/treasurer-approval") && method === "PATCH") {
        const body = JSON.parse(String(opts.body || "{}"));
        if (body.status === "pending") afterReset = true;
        return okJson({ success: true, contribution: {} });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    expect(screen.getByText("Approved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reset approval to pending for ada l/i }));
    expect(await screen.findByText(/Approval reset to pending/i)).toBeInTheDocument();
  });

  it("shows load error when detail request fails", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: failText("boom"),
      meetings: okJson({ meetings: [] }),
    });

    renderPayments();
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("allows treasurer to save reorder for upcoming payouts only", async () => {
    const detail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating" },
      membership: { ...detailBase.membership, group_role: "treasurer" },
      members: [
        { user_id: "u1", group_role: "treasurer", profiles: { full_name: "Treasurer One" } },
        { user_id: "u2", group_role: "member", profiles: { full_name: "Member Two" } },
        { user_id: "u3", group_role: "member", profiles: { full_name: "Member Three" } },
      ],
      payouts: [
        {
          id: "p1",
          user_id: "u2",
          target_month: "2026-01",
          scheduled_payout_date: "2026-01-05",
          cycle_index: 0,
        },
        {
          id: "p2",
          user_id: "u3",
          target_month: "2099-12",
          scheduled_payout_date: "2099-12-05",
          cycle_index: 1,
        },
        {
          id: "p3",
          user_id: "u1",
          target_month: "2100-01",
          scheduled_payout_date: "2100-01-05",
          cycle_index: 2,
        },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detail),
      meetings: okJson({ meetings: [] }),
      treasurerPatch: okJson({ ok: true }),
    });

    renderPayments();
    await screen.findByText("Payout schedule");
    expect(screen.getByText(/1 completed payout locked/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save upcoming payout order/i }));
    await screen.findByText("Upcoming payout order updated.");

    const reorderCall = global.fetch.mock.calls.find(
      ([u, o]) => String(u).endsWith("/payout-order") && o?.method === "PATCH",
    );
    expect(reorderCall).toBeTruthy();
    const body = JSON.parse(reorderCall[1].body);
    expect(body.orderedUpcomingPayoutIds).toEqual(["p2", "p3"]);
  });

  it("shows raw detail load error text when the response is JSON", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: failText('{"error":"Structured load failure"}'),
      meetings: okJson({ meetings: [] }),
    });

    renderPayments();
    expect(
      await screen.findByText('{"error":"Structured load failure"}'),
    ).toBeInTheDocument();
  });

  it("renders cached detail immediately then refreshes from the network", async () => {
    let resolveDetail;
    const detailDeferred = new Promise((resolve) => {
      resolveDetail = resolve;
    });

    readViewCacheMock.mockReturnValue({
      membership: { group_role: "member", stokvels: { name: "Cached Group" } },
      stokvel: { id: "stok-1", name: "Cached Group", status: "active", contribution_amount: 250 },
      members: detailBase.members,
      totalContribution: 999,
      contributions: detailBase.contributions,
      currentCycle: detailBase.currentCycle,
      payouts: [],
      missedPayments: [],
      meetings: [{ id: "cached-meeting" }],
    });

    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") return detailDeferred;
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") {
        return okJson({ meetings: [] });
      }
      if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET") {
        return okJson({ payouts: [] });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    renderPayments();
    expect(await screen.findByText("Cached Group")).toBeInTheDocument();
    expect(screen.getByText("R 999")).toBeInTheDocument();

    resolveDetail(okJson(detailBase));
    await waitFor(() => expect(screen.getByText("Main Group")).toBeInTheDocument());
  });

  it("falls back to cached meetings when meetings fetch fails", async () => {
    readViewCacheMock.mockReturnValue({
      membership: detailBase.membership,
      stokvel: detailBase.stokvel,
      members: detailBase.members,
      totalContribution: detailBase.totalContribution,
      contributions: detailBase.contributions,
      currentCycle: detailBase.currentCycle,
      payouts: [],
      missedPayments: [],
      meetings: [{ id: "cached-meeting" }],
    });
    setupFetch({
      detail: okJson(detailBase),
      meetings: { ok: false, text: async () => "meetings failed" },
    });

    renderPayments();
    await screen.findByText("Main Group");
    expect(writeViewCacheMock).toHaveBeenCalled();
    const lastWrite = writeViewCacheMock.mock.calls.at(-1)?.[1];
    expect(lastWrite?.meetings).toEqual([{ id: "cached-meeting" }]);
  });

  it("hides treasurer and payout manager controls for standard members", async () => {
    readViewCacheMock.mockReturnValue(null);
    const rotatingDetail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating" },
      membership: { ...detailBase.membership, group_role: "member" },
      payouts: [
        {
          id: "p1",
          user_id: "u2",
          target_month: "2099-12",
          scheduled_payout_date: "2099-12-05",
          cycle_index: 0,
        },
        {
          id: "p2",
          user_id: "u1",
          target_month: "2100-01",
          scheduled_payout_date: "2100-01-05",
          cycle_index: 1,
        },
      ],
    };
    setupFetch({ detail: okJson(rotatingDetail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    await screen.findByText("Cycle ledger");
    expect(screen.queryByText("Assign treasurer")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save upcoming payout order/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Payouts (Treasurer)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve payment/i })).not.toBeInTheDocument();
  });

  it("shows approval error when treasurer approval PATCH fails", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detailTreasurer),
      meetings: okJson({ meetings: [] }),
      approvalPatch: failText('{"error":"Approval rejected"}'),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /approve payment for ada l/i }));
    expect(await screen.findByText("Approval rejected")).toBeInTheDocument();
  });

  it("shows treasurer payout fetch errors in the treasurer payouts panel", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detailTreasurer),
      meetings: okJson({ meetings: [] }),
      treasurerPayouts: failText('{"error":"Payout list unavailable"}'),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    expect(await screen.findByText("Payout list unavailable")).toBeInTheDocument();
    expect(screen.getByText("No payout records available.")).toBeInTheDocument();
  });

  it("shows payout order save errors for treasurer managers", async () => {
    const detail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating" },
      membership: { ...detailBase.membership, group_role: "treasurer" },
      members: [
        { user_id: "u1", group_role: "treasurer", profiles: { full_name: "Treasurer One" } },
        { user_id: "u2", group_role: "member", profiles: { full_name: "Member Two" } },
        { user_id: "u3", group_role: "member", profiles: { full_name: "Member Three" } },
      ],
      payouts: [
        {
          id: "p1",
          user_id: "u2",
          target_month: "2099-12",
          scheduled_payout_date: "2099-12-05",
          cycle_index: 0,
        },
        {
          id: "p2",
          user_id: "u3",
          target_month: "2100-01",
          scheduled_payout_date: "2100-01-05",
          cycle_index: 1,
        },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detail),
      meetings: okJson({ meetings: [] }),
      payoutOrderPatch: failText('{"error":"Reorder blocked"}'),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u1" } } };
    renderPayments();
    await screen.findByText("Payout schedule");
    fireEvent.click(screen.getByRole("button", { name: /Save upcoming payout order/i }));
    expect(await screen.findByText("Reorder blocked")).toBeInTheDocument();
  });

  it("surfaces missed-payment flag errors from the API", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [],
      payouts: [
        {
          id: "p-past",
          user_id: "u2",
          target_month: "2026-03",
          scheduled_payout_date: "2026-03-05",
          cycle_index: 0,
        },
      ],
      currentCycle: { targetMonth: "2026-04", inPaymentWindow: true },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detailTreasurer),
      meetings: okJson({ meetings: [] }),
      missedPaymentPost: failText('{"error":"Cannot flag member"}'),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /^Flag$/i }));
    expect(await screen.findByText(/Flag missed payment/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    expect(await screen.findByText("Cannot flag member")).toBeInTheDocument();
  });

  it("shows empty ledger copy when members exist but no payment history is recorded", async () => {
    const detail = {
      ...detailBase,
      contributions: [],
      payouts: [],
      missedPayments: [],
      currentCycle: null,
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    await screen.findByText("No contribution cycles recorded yet.");
    expect(screen.getByText("No payout schedule yet.")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
