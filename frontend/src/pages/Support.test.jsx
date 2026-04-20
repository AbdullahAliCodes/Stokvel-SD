import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Support from "./Support";
import { cardLight, pageSubtitle } from "../ui";

vi.mock("lucide-react", () => ({
  LifeBuoy: (props) => <svg data-testid="support-icon" {...props} />,
}));

describe("Support", () => {
  it("renders the support heading, icon, and subtitle", () => {
    render(<Support />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Support" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("support-icon")).toBeInTheDocument();
    expect(screen.getByText("Help center and contact — coming soon.")).toBeInTheDocument();
  });

  it("renders the support information message for urgent issues", () => {
    render(<Support />);

    expect(
      screen.getByText(
        /For urgent issues, your group treasurer or system admin can log tickets from the admin dashboard/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/\(wireframe: Issue Tickets\)/i)).toBeInTheDocument();
  });

  it("applies shared UI token classes for subtitle and support card", () => {
    const { container } = render(<Support />);

    const subtitle = screen.getByText("Help center and contact — coming soon.");
    expect(subtitle).toHaveClass(...pageSubtitle.split(" "));

    const cardSelector = `.${cardLight.split(" ").join(".")}`;
    const card = container.querySelector(cardSelector);
    expect(card).toBeTruthy();
  });
});
