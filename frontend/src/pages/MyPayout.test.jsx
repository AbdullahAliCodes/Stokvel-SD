import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyPayout from "./MyPayout";
import { cardLight, pageSubtitle } from "../ui";

vi.mock("lucide-react", () => ({
  Wallet: (props) => <svg data-testid="wallet-icon" {...props} />,
}));

describe("MyPayout", () => {
  it("renders the payout page heading, subtitle, and wallet icon", () => {
    render(<MyPayout />);

    expect(
      screen.getByRole("heading", { level: 1, name: "My payout" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Payout history and schedule — coming soon."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("wallet-icon")).toBeInTheDocument();
  });

  it("renders both summary cards with expected labels, values, and placeholders", () => {
    render(<MyPayout />);

    expect(screen.getByText("Next expected")).toBeInTheDocument();
    expect(screen.getByText("R 50,000.00")).toBeInTheDocument();

    expect(screen.getByText("Total received (YTD)")).toBeInTheDocument();
    expect(screen.getByText("R 0.00")).toBeInTheDocument();

    const placeholders = screen.getAllByText("Placeholder");
    expect(placeholders).toHaveLength(2);
  });

  it("applies shared UI classes for subtitle and cards", () => {
    const { container } = render(<MyPayout />);

    const subtitle = screen.getByText("Payout history and schedule — coming soon.");
    expect(subtitle).toHaveClass(...pageSubtitle.split(" "));

    const cardNodes = container.querySelectorAll(`div.${cardLight.split(" ").join(".")}`);
    expect(cardNodes.length).toBeGreaterThanOrEqual(2);
  });
});
