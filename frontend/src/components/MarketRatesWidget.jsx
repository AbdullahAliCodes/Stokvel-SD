import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiUrl } from "../utils/api";
import { cardLight } from "../ui";

const CHART_MONTHS = [1, 2, 3, 6, 9, 12];

function buildProjectionPoints(contribution, primeRatePercent) {
  const pmt = Number(contribution) || 0;
  const annual = Number(primeRatePercent);
  if (!Number.isFinite(annual)) return [];

  const r = annual / 100 / 12;
  return CHART_MONTHS.map((month) => {
    const fv = r === 0 ? pmt * month : pmt * ((Math.pow(1 + r, month) - 1) / r);
    return { month: `M${month}`, value: parseFloat(fv.toFixed(2)) };
  });
}

export default function MarketRatesWidget({ memberMonthlyContribution = 0 }) {
  const [rates, setRates] = useState(null);
  const [projection, setProjection] = useState([]);
  const [error, setError] = useState(null);

  const contribution = Number(memberMonthlyContribution) || 0;

  const loadRates = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/market-rates"));
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.error || text || `HTTP ${res.status}`);
      setRates(data);
    } catch (e) {
      setRates(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  useEffect(() => {
    if (
      rates?.prime_rate == null ||
      !Number.isFinite(Number(rates.prime_rate))
    ) {
      setProjection([]);
      return;
    }
    setProjection(buildProjectionPoints(contribution, rates.prime_rate));
  }, [rates, contribution]);

  if (error) {
    return (
      <div className={`${cardLight} p-6`}>
        <p className="text-sm font-bold text-emerald-800">SA reference rates</p>
        <p className="mt-2 text-xs text-red-800">{error}</p>
      </div>
    );
  }

  if (!rates) {
    return (
      <div className={`${cardLight} p-6`}>
        <p className="text-sm text-stone-500">Loading rates…</p>
      </div>
    );
  }

  return (
    <div className={`${cardLight} flex flex-col gap-4 p-6`}>
      <p className="text-sm font-bold text-emerald-800">SA reference rates</p>
      <div className="flex flex-wrap gap-3 text-xs text-stone-700">
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
          Repo: <strong className="text-emerald-900">{rates.repo_rate}%</strong>
        </span>
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
          Prime:{" "}
          <strong className="text-emerald-900">{rates.prime_rate}%</strong>
        </span>
        <span className="text-stone-500">
          Updated{" "}
          {rates.last_updated
            ? new Date(rates.last_updated).toLocaleString("en-ZA", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "—"}
        </span>
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Estimated savings growth
        </h4>
        {contribution <= 0 ? (
          <p className="text-xs text-stone-500">
            Set a monthly contribution on this group to see a projection curve.
          </p>
        ) : (
          <div className="h-[220px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={projection}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgb(231 229 228)"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#78716c", fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: "#78716c", fontSize: 10 }}
                  tickFormatter={(v) =>
                    `R${Number(v).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid rgb(214 211 209)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#292524",
                  }}
                  formatter={(v) => [
                    `R${Number(v).toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`,
                    "Balance",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#047857"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#047857" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
