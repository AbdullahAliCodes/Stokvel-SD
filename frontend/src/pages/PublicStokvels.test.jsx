import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicStokvels from "./PublicStokvels";

const { navState, sessionState } = vi.hoisted(() => ({
  navState: { navigate: vi.fn() },
  sessionState: { current: { session: null } },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} data-to={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => navState.navigate,
}));

vi.mock("../context/SessionContext", () => ({
  useSession: () => sessionState.current,
}));

vi.mock("../utils/api", () => ({
  apiUrl: (path) => `http://test${path}`,
}));

vi.mock("../utils/stokvelMembership", () => ({
  myStokvelsCacheKey: (userId) => `my_stokvels:${userId}`,
}));

vi.mock("../utils/viewCache", () => ({
  readViewCache: vi.fn(() => null),
  writeViewCache: vi.fn(),
}));

vi.mock("../components/OpportunityCard", () => ({
  default: ({ name, subtitle, metrics, onApply, isJoining }) => (
    <article data-testid="opportunity-card">
      <h2>{name}</h2>
      <p>{subtitle}</p>
      <p>
        {metrics[0].label}:{metrics[0].value}
      </p>
      <p>
        {metrics[1].label}:{metrics[1].value}
      </p>
      <button type="button" onClick={onApply}>
        Apply
      </button>
      {isJoining ? <span>Joining...</span> : null}
    </article>
  ),
}));

function responseOk(body) {
  return { ok: true, text: async () => body };
}

function responseFail(body) {
  return { ok: false, text: async () => body };
}

describe("PublicStokvels", () => {
  beforeEach(() => {
    navState.navigate.mockReset();
    sessionState.current = { session: null };
    global.fetch = vi.fn();
  });

  it("renders loading state while public stokvels are being fetched", () => {
    global.fetch.mockImplementation(
      () =>
        new Promise(() => {
          // keep pending to assert loading UI
        }),
    );
    render(<PublicStokvels />);
    expect(screen.getByText("Loading public stokvels...")).toBeInTheDocument();
  });

  it("renders API error message when public stokvels request fails with JSON payload", async () => {
    global.fetch.mockResolvedValueOnce(responseFail(JSON.stringify({ error: "Directory offline" })));
    render(<PublicStokvels />);
    expect(await screen.findByText('{"error":"Directory offline"}')).toBeInTheDocument();
  });

  it("renders fallback error message when public stokvels request fails with plain text", async () => {
    global.fetch.mockResolvedValueOnce(responseFail("Service unavailable"));
    render(<PublicStokvels />);
    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  });

  it("renders empty state when API returns an empty array", async () => {
    global.fetch.mockResolvedValueOnce(responseOk(JSON.stringify([])));
    render(<PublicStokvels />);
    expect(
      await screen.findByText("No public stokvels are available yet. Check back soon."),
    ).toBeInTheDocument();
  });

  it("renders cards with formatted fallback values from public stokvel data", async () => {
    global.fetch.mockResolvedValueOnce(
      responseOk(
        JSON.stringify([
          {
            id: "s1",
            name: "",
            type: "",
            cycle_length: 0,
            contribution_amount: "invalid",
            members_count: null,
          },
          {
            id: "s2",
            name: "Future Savers",
            type: "Investment",
            cycle_length: 3,
            contribution_amount: 1250,
            members_count: 8,
          },
        ]),
      ),
    );

    render(<PublicStokvels />);

    expect(await screen.findByText("Stokvel")).toBeInTheDocument();
    expect(screen.getByText("Community savings · 1 month cycle")).toBeInTheDocument();
    expect(screen.getByText("Contribution:R 0")).toBeInTheDocument();
    expect(screen.getByText("Members:0")).toBeInTheDocument();

    expect(screen.getByText("Future Savers")).toBeInTheDocument();
    expect(screen.getByText("Investment · 3 month cycle")).toBeInTheDocument();
    expect(screen.getByText(/Contribution:\s*R 1.*250/)).toBeInTheDocument();
    expect(screen.getByText("Members:8")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to /auth when applying", async () => {
    global.fetch.mockResolvedValueOnce(
      responseOk(JSON.stringify([{ id: "s1", name: "Joinable", contribution_amount: 100, members_count: 1 }])),
    );
    render(<PublicStokvels />);
    await screen.findByText("Joinable");
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]);
    expect(navState.navigate).toHaveBeenCalledWith("/auth");
  });

  it("joins stokvel and navigates to group dashboard for authenticated user", async () => {
    sessionState.current = { session: { access_token: "token-abc", user: { id: "u1" } } };
    global.fetch
      .mockResolvedValueOnce(
        responseOk(JSON.stringify([{ id: "s1", name: "Joinable", contribution_amount: 200, members_count: 2 }])),
      )
      .mockResolvedValueOnce(responseOk("{}"));

    render(<PublicStokvels />);
    await screen.findByText("Joinable");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(navState.navigate).toHaveBeenCalledWith("/group/s1/dashboard", { replace: true }),
    );
  });

  it("shows join error from JSON API payload and clears joining state", async () => {
    sessionState.current = { session: { access_token: "token-abc", user: { id: "u1" } } };
    global.fetch
      .mockResolvedValueOnce(
        responseOk(JSON.stringify([{ id: "s1", name: "Joinable", contribution_amount: 200, members_count: 2 }])),
      )
      .mockResolvedValueOnce(responseFail(JSON.stringify({ error: "Invite required" })));

    render(<PublicStokvels />);
    await screen.findByText("Joinable");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Invite required")).toBeInTheDocument();
    expect(screen.queryByText("Joining...")).not.toBeInTheDocument();
  });

  it("shows join error from plain text API response", async () => {
    sessionState.current = { session: { access_token: "token-abc", user: { id: "u1" } } };
    global.fetch
      .mockResolvedValueOnce(
        responseOk(JSON.stringify([{ id: "s1", name: "Joinable", contribution_amount: 200, members_count: 2 }])),
      )
      .mockResolvedValueOnce(responseFail("Join blocked"));

    render(<PublicStokvels />);
    await screen.findByText("Joinable");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Join blocked")).toBeInTheDocument();
  });

  it("navigates to dashboard when API says user is already a member", async () => {
    sessionState.current = { session: { access_token: "token-abc", user: { id: "u1" } } };
    global.fetch
      .mockResolvedValueOnce(
        responseOk(JSON.stringify([{ id: "s1", name: "Joinable", contribution_amount: 200, members_count: 2 }])),
      )
      .mockResolvedValueOnce(responseFail(JSON.stringify({ error: "You are already a member of this group." })));

    render(<PublicStokvels />);
    await screen.findByText("Joinable");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(navState.navigate).toHaveBeenCalledWith("/group/s1/dashboard", { replace: true });
    });
    expect(screen.queryByText("You are already a member of this group.")).not.toBeInTheDocument();
  });
});
