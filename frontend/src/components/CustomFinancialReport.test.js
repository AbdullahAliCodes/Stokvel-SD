import { describe, expect, it } from "vitest";
import {
  buildCustomFinancialRows,
  getExpectedPayoutAmount,
} from "./CustomFinancialReport";

describe("CustomFinancialReport helpers", () => {
  it("getExpectedPayoutAmount uses fixedPool for Fixed stokvels", () => {
    const amount = getExpectedPayoutAmount(
      { type: "Fixed", contribution_amount: 500, cycle_length: 12 },
      [{ user_id: "a" }, { user_id: "b" }],
      { expected_payout_per_member: 6420 },
    );
    expect(amount).toBe(6420);
  });

  it("getExpectedPayoutAmount uses pool size for Rotating stokvels", () => {
    const amount = getExpectedPayoutAmount(
      { type: "Rotating", contribution_amount: 200 },
      [{ user_id: "a" }, { user_id: "b" }],
      null,
    );
    expect(amount).toBe(400);
  });

  it("buildCustomFinancialRows aggregates group month totals", () => {
    const rows = buildCustomFinancialRows({
      effectiveStokvel: { type: "Rotating", contribution_amount: 100 },
      members: [{ user_id: "a" }, { user_id: "b" }],
      contributions: [
        {
          user_id: "a",
          target_month: "2026-01",
          amount: 100,
          treasurer_approval_status: "approved",
        },
      ],
      missedPayments: [{ user_id: "b", target_month: "2026-01" }],
      payouts: [{ user_id: "a", target_month: "2026-01" }],
      months: ["2026-01"],
      targetMode: "group",
      selectedMemberId: "a",
      fixedPool: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].expectedContributions).toBe(200);
    expect(rows[0].actualPaid).toBe(100);
    expect(rows[0].missedValue).toBe(100);
    expect(rows[0].expectedPayouts).toBe(200);
  });
});
