import axios from "axios";
import { updateMarketRates } from "../services/marketDataService.js";

const FRED_OBSERVATIONS_URL =
  "https://api.stlouisfed.org/fred/series/observations";

/**
 * FRED / OECD: South Africa central bank policy rate (monthly, percent).
 * https://fred.stlouisfed.org/series/IRSTCB01ZAM156N
 * Underlying authority: SARB; series may lag MPC dates slightly.
 */
const DEFAULT_SA_POLICY_SERIES_ID = "IRSTCB01ZAM156N";

const MAX_FRED_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeFredBody(data, maxLen = 400) {
  if (data == null) return "";
  const s = typeof data === "string" ? data : JSON.stringify(data);
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

/** True when outbound HTTPS failed TLS certificate verification (Node / axios). */
export function fredTlsCertificateError(err) {
  const chain = [];
  let e = err;
  for (let i = 0; i < 6 && e; i += 1) {
    chain.push(e);
    e = e.cause;
  }
  const codes = new Set([
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
  ]);
  for (const x of chain) {
    const code = x?.code;
    if (code && codes.has(code)) return true;
    const msg = String(x?.message ?? "");
    if (/UNABLE_TO_VERIFY_LEAF_SIGNATURE/i.test(msg)) return true;
    if (
      /certificate/i.test(msg) &&
      /verify|verification|invalid|unknown ca/i.test(msg)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * GET observations; read status + body (FRED often returns JSON errors with HTTP 400).
 * Retries a few times on HTTP 5xx / rate limit / network blips.
 */
async function fetchFredObservationsJson(apiKey, seriesId) {
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_FRED_ATTEMPTS; attempt += 1) {
    try {
      const { data, status } = await axios.get(FRED_OBSERVATIONS_URL, {
        params: {
          series_id: seriesId,
          api_key: apiKey,
          file_type: "json",
          sort_order: "desc",
          limit: 1,
        },
        timeout: 20_000,
        validateStatus: () => true,
        headers: {
          Accept: "application/json",
          "User-Agent": "StokvelBackend/1.0 (FRED client)",
        },
      });

      if (status === 200 && data?.error_code == null) {
        return data;
      }

      const detail = summarizeFredBody(data);
      if (status === 429 || (status >= 500 && attempt < MAX_FRED_ATTEMPTS)) {
        console.warn(
          `[FRED] attempt ${attempt}/${MAX_FRED_ATTEMPTS} HTTP ${status}, retrying… ${detail}`,
        );
        await sleep(1500 * attempt);
        continue;
      }

      throw new Error(`FRED HTTP ${status}: ${detail || "(empty body)"}`);
    } catch (err) {
      lastErr = err;
      if (fredTlsCertificateError(err)) {
        throw err;
      }
      if (
        axios.isAxiosError(err) &&
        err.response == null &&
        attempt < MAX_FRED_ATTEMPTS
      ) {
        console.warn(
          `[FRED] attempt ${attempt}/${MAX_FRED_ATTEMPTS} network error (${err.code ?? "unknown"}), retrying…`,
        );
        await sleep(1500 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("FRED: exhausted retries");
}

/**
 * Fetches the latest observation and updates `market_data` (repo + derived prime).
 * Never throws — failures are logged only so callers (cron, startup) cannot crash the process.
 */
export async function fetchRepoRateFromFred() {
  try {
    const apiKey = process.env.FRED_API_KEY?.trim();
    if (!apiKey) {
      console.warn("[FRED] FRED_API_KEY not set; skipping rate fetch");
      return;
    }

    const seriesId =
      process.env.FRED_SA_POLICY_RATE_SERIES_ID?.trim() ||
      DEFAULT_SA_POLICY_SERIES_ID;

    let repoRate;
    try {
      const data = await fetchFredObservationsJson(apiKey, seriesId);

      if (data?.error_code != null) {
        throw new Error(
          data?.error_message ||
            data?.message ||
            `FRED error ${data.error_code}`,
        );
      }

      const obs = data?.observations?.[0];
      if (!obs || obs.value == null || obs.value === ".") {
        throw new Error("FRED returned no usable observation");
      }

      repoRate = parseFloat(String(obs.value).replace(",", "."));
      if (!Number.isFinite(repoRate)) {
        throw new Error(`Invalid rate from FRED: ${obs.value}`);
      }

      console.log(
        `[FRED] Policy rate ${seriesId} (${obs.date}): ${repoRate}% → updating market_data`,
      );
    } catch (err) {
      if (fredTlsCertificateError(err)) {
        console.warn("FRED sync skipped: certificate error");
        return;
      }
      if (axios.isAxiosError(err)) {
        const st = err.response?.status;
        const body = summarizeFredBody(err.response?.data);
        console.error(
          "[FRED] Request failed:",
          err.message,
          st != null ? `HTTP ${st}` : "",
          body ? `body: ${body}` : "",
        );
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[FRED] Rate fetch failed:", msg);
      }
      return;
    }

    try {
      await updateMarketRates(repoRate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[FRED] Supabase market_data update failed:", msg);
    }
  } catch (unexpected) {
    const msg =
      unexpected instanceof Error ? unexpected.message : String(unexpected);
    console.error("[FRED] Unexpected error (job skipped):", msg);
  }
}
