import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children, onDragEnd }) => (
    <div
      data-testid="payments-dnd"
      onClick={() =>
        onDragEnd?.({
          draggableId: "p2",
          source: { index: 1, droppableId: "upcoming-payouts" },
          destination: { index: 0, droppableId: "upcoming-payouts" },
        })
      }
    >
      {children}
    </div>
  ),
  Droppable: ({ children }) =>
    children({ innerRef: () => {}, droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children, draggableId }) =>
    children(
      {
        innerRef: () => {},
        draggableProps: { "data-rfd-draggable-id": draggableId },
        dragHandleProps: {},
      },
      { isDragging: false },
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
    if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET" && !u.includes("/disburse")) {
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

  it("surfaces reload errors after quick pay success when detail refresh fails", async () => {
    readViewCacheMock.mockReturnValue(null);
    let detailCalls = 0;
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") {
        detailCalls += 1;
        if (detailCalls === 1) return okJson(detailBase);
        return failText("Reload failed");
      }
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") {
        return okJson({ meetings: [] });
      }
      if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET") {
        return okJson({ payouts: [] });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    renderPayments();
    await screen.findByText("Payments & finances");
    fireEvent.click(screen.getByRole("button", { name: /Pay monthly contribution/i }));
    fireEvent.click(screen.getByRole("button", { name: "success" }));

    expect(await screen.findByText(/Reload failed/i)).toBeInTheDocument();
  });

  it("lets treasurer disburse an eligible payout and shows success", async () => {
    const pastDate = "2020-01-05";
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      members: [
        { user_id: "u1", group_role: "member", profiles: { first_name: "Ada", last_name: "L" } },
        { user_id: "u2", group_role: "treasurer", profiles: { first_name: "John", last_name: "T" } },
      ],
      payouts: [],
    };
    readViewCacheMock.mockReturnValue(null);
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") return okJson(detailTreasurer);
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") {
        return okJson({ meetings: [] });
      }
      if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET" && !u.includes("/disburse")) {
        return okJson({
          payouts: [
            {
              id: "p-disburse",
              user_id: "u1",
              scheduled_payout_date: pastDate,
              status: "pending",
              profile: { first_name: "Ada", last_name: "L" },
            },
          ],
        });
      }
      if (u.includes("/payouts/p-disburse/disburse") && method === "POST") {
        return okJson({ success: true, payout: { status: "completed" } });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    const treasurerSection = (await screen.findByText("Payouts (Treasurer)")).closest("section");
    await within(treasurerSection).findByText("Ada L");
    fireEvent.click(within(treasurerSection).getByRole("button", { name: "Payout" }));
    expect(await screen.findByText("Payout marked as completed.")).toBeInTheDocument();
  });

  it("shows disburse errors in the treasurer payouts panel", async () => {
    const pastDate = "2020-01-05";
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      members: [
        { user_id: "u1", group_role: "member", profiles: { first_name: "Ada", last_name: "L" } },
        { user_id: "u2", group_role: "treasurer", profiles: { first_name: "John", last_name: "T" } },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") return okJson(detailTreasurer);
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") {
        return okJson({ meetings: [] });
      }
      if (u.endsWith("/api/stokvels/stok-1/payouts") && method === "GET" && !u.includes("/disburse")) {
        return okJson({
          payouts: [
            {
              id: "p-disburse",
              user_id: "u1",
              scheduled_payout_date: pastDate,
              status: "pending",
              profile: { first_name: "Ada" },
            },
          ],
        });
      }
      if (u.includes("/payouts/p-disburse/disburse") && method === "POST") {
        return { ok: false, text: async () => '{"error":"Disburse blocked"}' };
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    const treasurerSection = (await screen.findByText("Payouts (Treasurer)")).closest("section");
    await within(treasurerSection).findByText("Ada");
    fireEvent.click(within(treasurerSection).getByRole("button", { name: "Payout" }));
    expect(await screen.findByText("Disburse blocked")).toBeInTheDocument();
  });

  it("lets treasurer approve or reset a rejected contribution", async () => {
    const rejectedDetail = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [
        { ...detailBase.contributions[0], treasurer_approval_status: "rejected" },
      ],
    };
    const approvedDetail = {
      ...rejectedDetail,
      contributions: [
        { ...rejectedDetail.contributions[0], treasurer_approval_status: "approved" },
      ],
    };
    const pendingDetail = {
      ...rejectedDetail,
      contributions: [
        { ...rejectedDetail.contributions[0], treasurer_approval_status: "pending" },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    let phase = "rejected";
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") {
        if (phase === "rejected") return okJson(rejectedDetail);
        if (phase === "approved") return okJson(approvedDetail);
        return okJson(pendingDetail);
      }
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") return okJson({ meetings: [] });
      if (u.includes("/contributions/") && u.endsWith("/treasurer-approval") && method === "PATCH") {
        const body = JSON.parse(String(opts.body || "{}"));
        if (body.status === "approved") phase = "approved";
        if (body.status === "pending") phase = "pending";
        return okJson({ success: true, contribution: {} });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /approve payment for ada l/i }));
    expect(await screen.findByText("Payment marked as approved.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset approval to pending for ada l/i }));
    expect(await screen.findByText(/Approval reset to pending/i)).toBeInTheDocument();
  });

  it("closes quick pay without reloading when the modal is dismissed", async () => {
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detailBase), meetings: okJson({ meetings: [] }) });

    renderPayments();
    await screen.findByText("Cycle ledger");
    const fetchCountBefore = global.fetch.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Pay monthly contribution/i }));
    expect(screen.getByTestId("quickpay-modal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByTestId("quickpay-modal")).not.toBeInTheDocument();
    expect(global.fetch.mock.calls.length).toBe(fetchCountBefore);
  });

  it("marks a paid contribution as not approved from the ledger", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detailTreasurer),
      meetings: okJson({ meetings: [] }),
      approvalPatch: okJson({ success: true, contribution: {} }),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(
      screen.getByRole("button", { name: /reject payment confirmation for ada l/i }),
    );
    expect(await screen.findByText("Payment marked as not approved.")).toBeInTheDocument();
  });

  it("shows already-flagged toast when missed payment was previously recorded", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [],
      payouts: [
        {
          id: "p-past",
          user_id: "u1",
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
      missedPaymentPost: okJson({ success: true, alreadyFlagged: true }),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /^Flag$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    expect(await screen.findByText("Already flagged for that month.")).toBeInTheDocument();
  });

  it("closes the missed-payment dialog without submitting when cancelled", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [],
      payouts: [
        {
          id: "p-past",
          user_id: "u1",
          target_month: "2026-03",
          scheduled_payout_date: "2026-03-05",
          cycle_index: 0,
        },
      ],
      currentCycle: { targetMonth: "2026-04", inPaymentWindow: true },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detailTreasurer), meetings: okJson({ meetings: [] }) });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /^Flag$/i }));
    expect(await screen.findByText(/Flag missed payment/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByText(/Flag missed payment/i)).not.toBeInTheDocument();
    });
    expect(
      global.fetch.mock.calls.filter(([u]) => String(u).includes("/missed-payments")),
    ).toHaveLength(0);
  });

  it("shows Unpaid (Missed Deadline) for flagged past months without payment", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [],
      missedPayments: [
        {
          user_id: "u1",
          target_month: "2026-03",
          resolved_at: null,
        },
      ],
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
    setupFetch({ detail: okJson(detailTreasurer), meetings: okJson({ meetings: [] }) });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    expect(await screen.findByText("Unpaid (Missed Deadline)")).toBeInTheDocument();
  });

  it("marks an approved contribution as not approved from the ledger", async () => {
    const approvedDetail = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [
        { ...detailBase.contributions[0], treasurer_approval_status: "approved" },
      ],
    };
    const rejectedDetail = {
      ...approvedDetail,
      contributions: [
        { ...approvedDetail.contributions[0], treasurer_approval_status: "rejected" },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    let phase = "approved";
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") {
        return okJson(phase === "approved" ? approvedDetail : rejectedDetail);
      }
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") {
        return okJson({ meetings: [] });
      }
      if (u.includes("/contributions/") && u.endsWith("/treasurer-approval") && method === "PATCH") {
        phase = "rejected";
        return okJson({ success: true, contribution: {} });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(
      screen.getByRole("button", { name: /mark payment as not approved for ada l/i }),
    );
    expect(await screen.findByText("Payment marked as not approved.")).toBeInTheDocument();
  });

  it("flags a missed payment for a past cycle and shows success toast", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [],
      missedPayments: [],
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
      missedPaymentPost: okJson({ success: true, alreadyFlagged: false }),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /^Flag$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    expect(await screen.findByText("Missed payment flagged.")).toBeInTheDocument();
  });

  it("renders fixed-pool finance stats and contribution hint", async () => {
    const fixedDetail = {
      ...detailBase,
      stokvel: {
        ...detailBase.stokvel,
        type: "Fixed",
        contribution_amount: 500,
        cycle_length: 6,
        status: "active",
      },
      fixedPool: {
        expected_payout_per_member: 3200,
        estimated_amount_made: 1500,
        member_contributions_to_date: 1200,
        member_interest_share_to_date: 300,
      },
      rates_stale: false,
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(fixedDetail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    expect(await screen.findByText("Estimated Amount Made")).toBeInTheDocument();
    expect(screen.getByText(/R\s?1[,\s]?500/)).toBeInTheDocument();
    expect(
      screen.getByText(/R\s?1[,\s]?200 contributed \+ R\s?300 est\. interest share/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("rates-widget")).toBeInTheDocument();
  });

  it("shows a dash for fixed estimates when market rates are stale", async () => {
    const fixedDetail = {
      ...detailBase,
      stokvel: {
        ...detailBase.stokvel,
        type: "Fixed",
        contribution_amount: 500,
        cycle_length: 6,
        status: "active",
      },
      fixedPool: null,
      rates_stale: true,
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(fixedDetail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    const estimatedCard = (await screen.findByText("Estimated Amount Made")).closest("div");
    expect(within(estimatedCard).getByText("—")).toBeInTheDocument();
  });

  it("disables quick pay when the member is the rotating payout receiver", async () => {
    const rotatingDetail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating", status: "active" },
      contributions: [],
      payouts: [
        {
          id: "p-current",
          user_id: "u1",
          target_month: "2026-04",
          scheduled_payout_date: "2026-04-05",
          cycle_index: 0,
        },
      ],
      currentCycle: { targetMonth: "2026-04", inPaymentWindow: true },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(rotatingDetail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    const quickPayBtn = await screen.findByRole("button", { name: /Pay monthly contribution/i });
    expect(quickPayBtn).toBeDisabled();
    expect(
      await screen.findByText(/You are receiving the payout this cycle/i),
    ).toBeInTheDocument();
  });

  it("disables quick pay after the member already paid for the active cycle", async () => {
    const paidDetail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating", status: "active" },
      contributions: [
        {
          id: "c-paid",
          amount: 500,
          paid_at: "2026-04-20",
          user_id: "u1",
          target_month: "2026-04",
          treasurer_approval_status: "pending",
          profiles: { full_name: "Ada L" },
        },
      ],
      currentCycle: { targetMonth: "2026-04", inPaymentWindow: true },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(paidDetail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    const quickPayBtn = await screen.findByRole("button", { name: /Pay monthly contribution/i });
    expect(quickPayBtn).toBeDisabled();
    expect(await screen.findByText(/You have already paid for this cycle/i)).toBeInTheDocument();
  });

  it("resets a rejected contribution to pending without approving first", async () => {
    const rejectedDetail = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [
        { ...detailBase.contributions[0], treasurer_approval_status: "rejected" },
      ],
    };
    const pendingDetail = {
      ...rejectedDetail,
      contributions: [
        { ...rejectedDetail.contributions[0], treasurer_approval_status: "pending" },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    let phase = "rejected";
    global.fetch = vi.fn(async (url, opts = {}) => {
      const method = opts.method ?? "GET";
      const u = String(url);
      if (u.endsWith("/api/stokvels/stok-1") && method === "GET") {
        return okJson(phase === "rejected" ? rejectedDetail : pendingDetail);
      }
      if (u.endsWith("/api/stokvels/stok-1/meetings") && method === "GET") {
        return okJson({ meetings: [] });
      }
      if (u.includes("/contributions/") && u.endsWith("/treasurer-approval") && method === "PATCH") {
        phase = "pending";
        return okJson({ success: true, contribution: {} });
      }
      throw new Error(`Unhandled fetch ${method} ${u}`);
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /reset approval to pending for ada l/i }));
    expect(await screen.findByText(/Approval reset to pending/i)).toBeInTheDocument();
  });

  it("does not save payout order when confirmation is rejected", async () => {
    confirmMock.mockResolvedValueOnce(false);
    const detail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating" },
      membership: { ...detailBase.membership, group_role: "treasurer" },
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
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detail), meetings: okJson({ meetings: [] }) });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Payout schedule");
    fireEvent.click(screen.getByRole("button", { name: /Save upcoming payout order/i }));

    const patchCalls = global.fetch.mock.calls.filter(
      ([u, o]) => String(u).endsWith("/payout-order") && o?.method === "PATCH",
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("reorders upcoming payouts and saves the new payout order", async () => {
    const detail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating" },
      membership: { ...detailBase.membership, group_role: "treasurer" },
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
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detail),
      meetings: okJson({ meetings: [] }),
      payoutOrderPatch: okJson({ success: true }),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Payout schedule");
    fireEvent.click(screen.getByTestId("payments-dnd"));
    fireEvent.click(screen.getByRole("button", { name: /Save upcoming payout order/i }));

    expect(await screen.findByText("Upcoming payout order updated.")).toBeInTheDocument();
    const patchCall = global.fetch.mock.calls.find(
      ([u, o]) => String(u).endsWith("/payout-order") && o?.method === "PATCH",
    );
    const body = JSON.parse(patchCall[1].body);
    expect(body.orderedUpcomingPayoutIds).toEqual(["p2", "p1"]);
  });

  it("allows quick pay outside the window when the member has an unresolved flag", async () => {
    const flaggedDetail = {
      ...detailBase,
      stokvel: { ...detailBase.stokvel, type: "Rotating", status: "active" },
      contributions: [],
      missedPayments: [{ user_id: "u1", target_month: "2026-03", resolved_at: null }],
      currentCycle: { targetMonth: "2026-04", inPaymentWindow: false },
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(flaggedDetail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    const quickPayBtn = await screen.findByRole("button", { name: /Pay monthly contribution/i });
    expect(quickPayBtn).toBeEnabled();
  });

  it("clears ledger toast messages after the display timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const detailTreasurer = {
        ...detailBase,
        membership: { ...detailBase.membership, group_role: "treasurer" },
      };
      readViewCacheMock.mockReturnValue(null);
      setupFetch({
        detail: okJson(detailTreasurer),
        meetings: okJson({ meetings: [] }),
        approvalPatch: okJson({ success: true, contribution: {} }),
      });

      sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
      renderPayments();
      await screen.findByText("Cycle ledger");
      fireEvent.click(screen.getByRole("button", { name: /approve payment for ada l/i }));
      expect(await screen.findByText("Payment marked as approved.")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.queryByText("Payment marked as approved.")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats non-JSON missed-payment responses as empty success payloads", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [],
      payouts: [
        {
          id: "p-past",
          user_id: "u1",
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
      missedPaymentPost: { ok: true, text: async () => "thanks" },
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /^Flag$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    expect(await screen.findByText("Missed payment flagged.")).toBeInTheDocument();
  });

  it("derives manager role from the members list when membership role is absent", async () => {
    const detail = {
      ...detailBase,
      membership: { group_role: null, stokvels: detailBase.membership.stokvels },
      members: [
        { user_id: "u1", group_role: "member", profiles: { full_name: "Ada L" } },
        { user_id: "u2", group_role: "treasurer", profiles: { full_name: "John T" } },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detail), meetings: okJson({ meetings: [] }) });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    expect(await screen.findByText("Payouts (Treasurer)")).toBeInTheDocument();
    expect(screen.getByText("Assign treasurer")).toBeInTheDocument();
  });

  it("shows zero fixed estimate when pool totals omit estimated amount made", async () => {
    const fixedDetail = {
      ...detailBase,
      stokvel: {
        ...detailBase.stokvel,
        type: "Fixed",
        contribution_amount: 500,
        cycle_length: 6,
        status: "active",
      },
      fixedPool: { expected_payout_per_member: 3200 },
      rates_stale: false,
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(fixedDetail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    const estimatedCard = (await screen.findByText("Estimated Amount Made")).closest("div");
    expect(within(estimatedCard).getByText(/R\s?0/)).toBeInTheDocument();
  });

  it("labels members without names or email as Member in the roster", async () => {
    const detail = {
      ...detailBase,
      members: [
        { user_id: "u9", group_role: "member", profiles: {} },
        { user_id: "u2", group_role: "treasurer", profiles: { email: "john@example.com" } },
      ],
      contributions: [],
      payouts: [],
      missedPayments: [],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    const roster = (await screen.findByText("Members")).closest("section") ?? document.body;
    expect(within(roster).getByText("Member")).toBeInTheDocument();
    expect(within(roster).getByText("john")).toBeInTheDocument();
  });

  it("approves the latest contribution when multiple rows exist for the same month", async () => {
    const detailTreasurer = {
      ...detailBase,
      membership: { ...detailBase.membership, group_role: "treasurer" },
      contributions: [
        {
          id: "c-old",
          amount: 500,
          paid_at: "2026-03-01T08:00:00.000Z",
          user_id: "u1",
          target_month: "2026-03",
          treasurer_approval_status: "pending",
          profiles: { full_name: "Ada L" },
        },
        {
          id: "c-new",
          amount: 500,
          paid_at: "2026-03-20T10:00:00.000Z",
          user_id: "u1",
          target_month: "2026-03",
          treasurer_approval_status: "pending",
          profiles: { full_name: "Ada L" },
        },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({
      detail: okJson(detailTreasurer),
      meetings: okJson({ meetings: [] }),
      approvalPatch: okJson({ success: true, contribution: {} }),
    });

    sessionState.current = { session: { access_token: "token-1", user: { id: "u2" } } };
    renderPayments();
    await screen.findByText("Cycle ledger");
    fireEvent.click(screen.getByRole("button", { name: /approve payment for ada l/i }));

    await waitFor(() => {
      const patchCall = global.fetch.mock.calls.find(
        ([u, o]) => String(u).includes("/contributions/c-new/treasurer-approval") && o?.method === "PATCH",
      );
      expect(patchCall).toBeTruthy();
    });
  });

  it("treats unknown treasurer approval status values as pending", async () => {
    const detail = {
      ...detailBase,
      contributions: [
        {
          ...detailBase.contributions[0],
          treasurer_approval_status: "weird-status",
        },
      ],
    };
    readViewCacheMock.mockReturnValue(null);
    setupFetch({ detail: okJson(detail), meetings: okJson({ meetings: [] }) });

    renderPayments();
    expect((await screen.findAllByText("Pending")).length).toBeGreaterThan(0);
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
