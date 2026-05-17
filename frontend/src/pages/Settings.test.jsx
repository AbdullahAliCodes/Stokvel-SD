import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";

const { routeState, sessionState } = vi.hoisted(() => ({
  routeState: { params: { stokvel_id: "stok-1" } },
  sessionState: { current: { session: { access_token: "token-1" } } },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => routeState.params,
}));

vi.mock("../context/SessionContext", () => ({
  useSession: () => sessionState.current,
}));

vi.mock("../utils/api", () => ({
  apiUrl: (path) => `http://test${path}`,
}));

function okJson(obj) {
  return { ok: true, text: async () => JSON.stringify(obj) };
}

function failText(text) {
  return { ok: false, text: async () => text };
}

describe("Settings", () => {
  beforeEach(() => {
    routeState.params = { stokvel_id: "stok-1" };
    sessionState.current = { session: { access_token: "token-1" } };
    global.fetch = vi.fn();
  });

  it("shows loading state before settings are fetched", () => {
    global.fetch.mockImplementation(
      () =>
        new Promise(() => {
          // pending fetch to keep loading state visible
        }),
    );

    render(<Settings />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("loads and renders settings form with API values", async () => {
    global.fetch.mockResolvedValueOnce(
      okJson({
        stokvel: {
          name: "Alpha Group",
          contribution_amount: 500,
          meeting_frequency: "weekly",
          is_public: true,
        },
      }),
    );

    render(<Settings />);

    expect(await screen.findByDisplayValue("Alpha Group")).toBeInTheDocument();
    expect(screen.getByDisplayValue("500")).toBeInTheDocument();
    expect(screen.getByLabelText("Meeting Frequency")).toHaveValue("weekly");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("normalizes unsupported meeting frequency to monthly", async () => {
    global.fetch.mockResolvedValueOnce(
      okJson({
        stokvel: {
          name: "Alpha Group",
          contribution_amount: 250,
          meeting_frequency: "quarterly",
          is_public: false,
        },
      }),
    );

    render(<Settings />);
    await screen.findByDisplayValue("Alpha Group");
    expect(screen.getByLabelText("Meeting Frequency")).toHaveValue("monthly");
  });

  it("shows load error from JSON error payload", async () => {
    global.fetch.mockResolvedValueOnce(failText(JSON.stringify({ error: "Load failed" })));
    render(<Settings />);
    expect(await screen.findByText("Load failed")).toBeInTheDocument();
  });

  it("shows load error from plain text response", async () => {
    global.fetch.mockResolvedValueOnce(failText("Request timed out"));
    render(<Settings />);
    expect(await screen.findByText("Request timed out")).toBeInTheDocument();
  });

  it("keeps loading state when missing token or stokvel id (guard branch)", () => {
    sessionState.current = { session: null };
    routeState.params = { stokvel_id: "stok-1" };
    render(<Settings />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits updated values and shows success message", async () => {
    global.fetch
      .mockResolvedValueOnce(
        okJson({
          stokvel: {
            name: "Initial Group",
            contribution_amount: 100,
            meeting_frequency: "monthly",
            is_public: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          stokvel: {
            name: "Updated Group",
            contribution_amount: 350,
            meeting_frequency: "bi-weekly",
            is_public: true,
          },
        }),
      );

    render(<Settings />);
    await screen.findByDisplayValue("Initial Group");

    fireEvent.change(screen.getByLabelText("Group Name"), { target: { value: "  Updated Group  " } });
    fireEvent.change(screen.getByLabelText("Monthly Contribution (R)"), {
      target: { value: "350" },
    });
    fireEvent.change(screen.getByLabelText("Meeting Frequency"), {
      target: { value: "bi-weekly" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Group settings updated successfully.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Updated Group")).toBeInTheDocument();
    expect(screen.getByDisplayValue("350")).toBeInTheDocument();
    expect(screen.getByLabelText("Meeting Frequency")).toHaveValue("bi-weekly");
    expect(screen.getByRole("checkbox")).toBeChecked();

    const patchCall = global.fetch.mock.calls.find(([, opts]) => opts?.method === "PATCH");
    const body = JSON.parse(patchCall[1].body);
    expect(body).toEqual({
      name: "Updated Group",
      contribution_amount: 350,
      meeting_frequency: "bi-weekly",
      is_public: true,
    });
  });

  it("falls back to existing local values when PATCH response omits updated fields", async () => {
    global.fetch
      .mockResolvedValueOnce(
        okJson({
          stokvel: {
            name: "Base Name",
            contribution_amount: 100,
            meeting_frequency: "monthly",
            is_public: false,
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ stokvel: {} }));

    render(<Settings />);
    await screen.findByDisplayValue("Base Name");

    fireEvent.change(screen.getByLabelText("Group Name"), { target: { value: "Local Name" } });
    fireEvent.change(screen.getByLabelText("Monthly Contribution (R)"), { target: { value: "410" } });
    fireEvent.change(screen.getByLabelText("Meeting Frequency"), { target: { value: "weekly" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Group settings updated successfully.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Local Name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("410")).toBeInTheDocument();
    expect(screen.getByLabelText("Meeting Frequency")).toHaveValue("monthly");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("shows save error from API and clears saving state", async () => {
    global.fetch
      .mockResolvedValueOnce(
        okJson({
          stokvel: {
            name: "Base",
            contribution_amount: 100,
            meeting_frequency: "monthly",
            is_public: false,
          },
        }),
      )
      .mockResolvedValueOnce(failText(JSON.stringify({ error: "Save failed" })));

    render(<Settings />);
    await screen.findByDisplayValue("Base");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument(),
    );
  });
});
