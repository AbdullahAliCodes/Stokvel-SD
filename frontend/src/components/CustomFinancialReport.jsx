import { useEffect, useMemo, useState } from "react";
import {
  btnPrimary,
  btnSecondary,
  cardLight,
  inputLight,
  labelLight,
  tableHead,
  tableRow,
} from "../ui";
import TableScrollArea from "./ui/TableScrollArea";
import { downloadCsv, downloadPdf } from "../utils/reportExport";

const COLUMN_KEYS = [
  "expectedContributions",
  "actualPaid",
  "missedValue",
  "expectedPayouts",
];

const COLUMN_LABELS = {
  expectedContributions: "Expected In (Target)",
  actualPaid: "Approved Paid (In)",
  missedValue: "Flagged Missed (Deficit)",
  expectedPayouts: "Scheduled Payouts (Out)",
};

const DEFAULT_COLUMNS = {
  expectedContributions: true,
  actualPaid: true,
  missedValue: true,
  expectedPayouts: true,
};

function formatZAR(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return "R 0";
  return `R ${Math.round(num).toLocaleString("en-ZA")}`;
}

function memberDisplay(p) {
  const first = p?.first_name?.trim();
  const last = p?.last_name?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  if (p?.full_name) return p.full_name;
  if (p?.email) return p.email.split("@")[0];
  return "Member";
}

function defaultMemberId(members, currentUserId) {
  if (
    currentUserId &&
    (members ?? []).some((m) => m.user_id === currentUserId)
  ) {
    return currentUserId;
  }
  return members?.[0]?.user_id ?? "";
}

function isApprovedContribution(c) {
  return (
    String(c?.treasurer_approval_status ?? "").toLowerCase() === "approved"
  );
}

function filterMonthsInRange(ledgerMonths, startMonth, endMonth) {
  if (!startMonth || !endMonth) return [];
  const lo = startMonth <= endMonth ? startMonth : endMonth;
  const hi = startMonth <= endMonth ? endMonth : startMonth;
  return (ledgerMonths ?? []).filter((m) => m >= lo && m <= hi);
}

/** Aligns with Payments.jsx expected payout / pool size per slot. */
export function getExpectedPayoutAmount(stokvel, members, fixedPool) {
  const memberCount = Array.isArray(members) ? members.length : 0;
  const monthlyContribution = Number(stokvel?.contribution_amount) || 0;
  const isFixedStokvel = String(stokvel?.type ?? "") === "Fixed";
  const fixedCycleLength = Math.max(
    1,
    Number(stokvel?.cycle_length) || memberCount,
  );
  const fixedMaturityPrincipal = monthlyContribution * fixedCycleLength;
  const maturityPayoutEstimate =
    isFixedStokvel && fixedPool?.expected_payout_per_member != null
      ? Number(fixedPool.expected_payout_per_member)
      : isFixedStokvel
        ? fixedMaturityPrincipal
        : monthlyContribution * memberCount;
  return isFixedStokvel
    ? maturityPayoutEstimate
    : monthlyContribution * memberCount;
}

export function buildCustomFinancialRows({
  effectiveStokvel,
  members,
  contributions,
  payouts,
  missedPayments,
  months,
  targetMode,
  selectedMemberId,
  fixedPool = null,
}) {
  const memberCount = (members ?? []).length;
  const monthlyContribution =
    Number(effectiveStokvel?.contribution_amount) || 0;
  const expectedPayoutPerSlot = getExpectedPayoutAmount(
    effectiveStokvel,
    members,
    fixedPool,
  );
  const isGroup = targetMode === "group";
  const groupExpectedIn = monthlyContribution * memberCount;
  const memberExpectedIn = monthlyContribution;

  return months.map((month) => {
    const contribRows = (contributions ?? []).filter(
      (c) =>
        c?.target_month === month &&
        (isGroup || c?.user_id === selectedMemberId),
    );
    const actualPaid = contribRows
      .filter(isApprovedContribution)
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const missedRows = (missedPayments ?? []).filter(
      (r) =>
        r?.target_month === month &&
        (isGroup || r?.user_id === selectedMemberId),
    );
    const missedValue = missedRows.length * monthlyContribution;

    const payoutRows = (payouts ?? []).filter(
      (p) =>
        p?.target_month === month &&
        (isGroup || p?.user_id === selectedMemberId),
    );
    const expectedPayouts = payoutRows.length * expectedPayoutPerSlot;

    return {
      month,
      expectedContributions: isGroup ? groupExpectedIn : memberExpectedIn,
      actualPaid,
      missedValue,
      expectedPayouts,
    };
  });
}

export default function CustomFinancialReport({
  effectiveStokvel,
  members = [],
  contributions = [],
  payouts = [],
  missedPayments = [],
  ledgerMonths = [],
  fixedPool = null,
  currentUserId = null,
}) {
  const groupName = effectiveStokvel?.name ?? "Group";
  const firstMonth = ledgerMonths[0] ?? "";
  const lastMonth = ledgerMonths[ledgerMonths.length - 1] ?? "";

  const [targetMode, setTargetMode] = useState("group");
  const [selectedMemberId, setSelectedMemberId] = useState(() =>
    defaultMemberId(members, currentUserId),
  );
  const [startMonth, setStartMonth] = useState(firstMonth);
  const [endMonth, setEndMonth] = useState(lastMonth);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    if (ledgerMonths.length === 0) return;
    setStartMonth((prev) => {
      if (prev && ledgerMonths.includes(prev)) return prev;
      return ledgerMonths[0];
    });
    setEndMonth((prev) => {
      if (prev && ledgerMonths.includes(prev)) return prev;
      return ledgerMonths[ledgerMonths.length - 1];
    });
  }, [ledgerMonths]);

  useEffect(() => {
    if (
      selectedMemberId &&
      members.some((m) => m.user_id === selectedMemberId)
    ) {
      return;
    }
    setSelectedMemberId(defaultMemberId(members, currentUserId));
  }, [members, currentUserId, selectedMemberId]);

  const filteredMonths = useMemo(
    () => filterMonthsInRange(ledgerMonths, startMonth, endMonth),
    [ledgerMonths, startMonth, endMonth],
  );

  const expectedPayoutPerSlot = useMemo(
    () => getExpectedPayoutAmount(effectiveStokvel, members, fixedPool),
    [effectiveStokvel, members, fixedPool],
  );

  const reportData = useMemo(() => {
    const memberCount = members.length;
    const monthlyContribution =
      Number(effectiveStokvel?.contribution_amount) || 0;
    const isGroup = targetMode === "group";
    const groupExpectedIn = monthlyContribution * memberCount;
    const memberExpectedIn = monthlyContribution;

    return filteredMonths.map((month) => {
      const contribRows = contributions.filter(
        (c) =>
          c?.target_month === month &&
          (isGroup || c?.user_id === selectedMemberId),
      );
      const actualPaid = contribRows
        .filter(isApprovedContribution)
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      const missedRows = missedPayments.filter(
        (r) =>
          r?.target_month === month &&
          (isGroup || r?.user_id === selectedMemberId),
      );
      const missedValue = missedRows.length * monthlyContribution;

      const payoutRows = payouts.filter(
        (p) =>
          p?.target_month === month &&
          (isGroup || p?.user_id === selectedMemberId),
      );
      const expectedPayouts = payoutRows.length * expectedPayoutPerSlot;

      return {
        month,
        expectedContributions: isGroup ? groupExpectedIn : memberExpectedIn,
        actualPaid,
        missedValue,
        expectedPayouts,
      };
    });
  }, [
    contributions,
    effectiveStokvel,
    expectedPayoutPerSlot,
    filteredMonths,
    members.length,
    missedPayments,
    payouts,
    selectedMemberId,
    targetMode,
  ]);

  const selectedMemberName = useMemo(() => {
    const m = members.find((row) => row.user_id === selectedMemberId);
    return memberDisplay(m?.profiles);
  }, [members, selectedMemberId]);

  const visibleColumnKeys = useMemo(
    () => COLUMN_KEYS.filter((key) => columns[key]),
    [columns],
  );

  const exportSubtitle = useMemo(() => {
    const range =
      startMonth && endMonth
        ? `${startMonth} – ${endMonth}`
        : "No period selected";
    if (targetMode === "member") {
      return `Personal Ledger: ${selectedMemberName} | ${range}`;
    }
    return `Group Cashflow Report | ${groupName} | ${range}`;
  }, [
    endMonth,
    groupName,
    selectedMemberName,
    startMonth,
    targetMode,
  ]);

  const exportHeaders = useMemo(
    () => ["Month", ...visibleColumnKeys.map((k) => COLUMN_LABELS[k])],
    [visibleColumnKeys],
  );

  const exportRows = useMemo(
    () =>
      reportData.map((row) => [
        row.month,
        ...visibleColumnKeys.map((key) => formatZAR(row[key])),
      ]),
    [reportData, visibleColumnKeys],
  );

  const canExport =
    visibleColumnKeys.length > 0 && exportRows.length > 0;

  function toggleColumn(key) {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleExportCsv() {
    if (!canExport) return;
    downloadCsv(
      `custom_financial_${groupName}`,
      exportHeaders,
      exportRows,
    );
  }

  function handleExportPdf() {
    if (!canExport) return;
    void downloadPdf({
      title: "Custom Financial Report",
      subtitle: exportSubtitle,
      headers: exportHeaders,
      rows: exportRows,
      filenameBase: `custom_financial_${groupName}`,
    });
  }

  if (ledgerMonths.length === 0) {
    return (
      <section
        id="custom-report"
        className={`${cardLight} mt-10 scroll-mt-6 p-5`}
      >
        <h2 className="mb-2 text-lg font-bold text-emerald-800 dark:text-emerald-300">
          Custom Financial Report
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Not enough ledger data yet to build a custom view. Contributions,
          payouts, or flagged missed payments will populate month options here.
        </p>
      </section>
    );
  }

  return (
    <section
      id="custom-report"
      className={`${cardLight} mt-10 scroll-mt-6 p-5`}
    >
      <h2 className="mb-1 text-lg font-bold text-emerald-800 dark:text-emerald-300">
        Custom Financial Report
      </h2>
      <p className="mb-5 text-sm text-stone-500 dark:text-stone-400">
        Filter in-memory group data and export a tailored cashflow table.
        Scheduled payout amounts use{" "}
        {String(effectiveStokvel?.type ?? "") === "Fixed" &&
        fixedPool?.expected_payout_per_member != null
          ? "Fixed maturity projections"
          : "rotating pool size"}{" "}
        ({formatZAR(expectedPayoutPerSlot)} per slot).
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelLight}>
          Target view
          <select
            className={inputLight}
            value={targetMode}
            onChange={(e) =>
              setTargetMode(
                e.target.value === "member" ? "member" : "group",
              )
            }
          >
            <option value="group">Entire group</option>
            <option value="member">Specific member</option>
          </select>
        </label>

        {targetMode === "member" ? (
          <label className={labelLight}>
            Member
            <select
              className={inputLight}
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {memberDisplay(m.profiles)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={labelLight}>
          Start month
          <select
            className={inputLight}
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          >
            {ledgerMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className={labelLight}>
          End month
          <select
            className={inputLight}
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
          >
            {ledgerMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mb-6">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Visible columns
        </legend>
        <div className="flex flex-wrap gap-4">
          {COLUMN_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 text-sm text-stone-700 dark:text-stone-200"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
                checked={Boolean(columns[key])}
                onChange={() => toggleColumn(key)}
              />
              {COLUMN_LABELS[key]}
            </label>
          ))}
        </div>
      </fieldset>

      {visibleColumnKeys.length === 0 ? (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
          Select at least one column to display the table.
        </p>
      ) : (
        <TableScrollArea>
          <table className="w-full min-w-[480px] text-left text-sm text-stone-800 dark:text-stone-100">
            <thead>
              <tr className={tableHead}>
                <th className="p-3">Month</th>
                {visibleColumnKeys.map((key) => (
                  <th key={key} className="p-3 text-right">
                    {COLUMN_LABELS[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr className={tableRow}>
                  <td
                    colSpan={visibleColumnKeys.length + 1}
                    className="p-4 text-center text-sm italic text-stone-500"
                  >
                    No months in the selected range.
                  </td>
                </tr>
              ) : (
                reportData.map((row) => (
                  <tr key={row.month} className={tableRow}>
                    <td className="p-3 font-medium whitespace-nowrap">
                      {row.month}
                    </td>
                    {visibleColumnKeys.map((key) => (
                      <td key={key} className="p-3 text-right whitespace-nowrap">
                        {formatZAR(row[key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScrollArea>
      )}

      <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
        Note: &apos;Approved Paid&apos; only includes contributions manually
        verified by the Treasurer. &apos;Flagged Missed&apos; only includes
        unresolved arrears. Scheduled payouts are estimated per slot, not
        disbursed cash.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!canExport}
          onClick={handleExportCsv}
          className={`${btnSecondary} text-xs disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Export CSV
        </button>
        <button
          type="button"
          disabled={!canExport}
          onClick={() => void handleExportPdf()}
          className={`${btnPrimary} text-xs disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Export PDF
        </button>
      </div>
    </section>
  );
}
