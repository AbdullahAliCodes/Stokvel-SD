import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  normalizeInviteEmail,
  sendMeetingScheduledEmail,
} from "../utils/invitations.js";
import {
  getServiceSupabase,
  createUserJwtSupabase,
} from "../utils/supabaseAdmin.js";
import { sendSupabaseFailure, isTransportLayerFailure } from "../utils/supabaseErrors.js";
import axios from "axios";
import { searchProfilesForMemberInvite } from "../utils/profileUserSearch.js";
import {
  getCurrentPaymentCycle,
  getTargetMonthForPaidAt,
  isPaidAtInWindowForTargetMonth,
  paymentWindowFromStokvel,
  zonedYmdParts,
} from "../utils/dates.js";
import { buildPayoutReport } from "../utils/payoutReport.js";
import { getMarketRates } from "../services/marketDataService.js";
import { computeFixedPoolProjection } from "../services/projectionService.js";

const router = Router();

const TARGET_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const UUID_RE_MEMBER =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Stokvel id from URL `:id`. Matches Postgres uuid text form without enforcing RFC variant/version bits (seed / hand-inserted ids). */
const UUID_RE_STOKVEL_PARAM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function userScopedSupabase(req) {
  const client = createUserJwtSupabase(req, "stokvels");
  if (!client) {
    const err = new Error("Could not initialize Supabase client.");
    err.code = "SUPABASE_CLIENT_UNAVAILABLE";
    throw err;
  }
  return client;
}

/** Tries joins in order so we still return rows if some columns are missing in your DB. */
async function fetchStokvelMembers(userSupabase, stokvelId) {
  const { data, error } = await userSupabase
    .from("stokvel_members")
    .select("user_id, group_role, profiles(first_name, last_name)")
    .eq("stokvel_id", stokvelId);

  if (error) {
    if (isTransportLayerFailure(error)) {
      console.warn("fetchStokvelMembers transport:", error.message);
    } else {
      console.error("fetchStokvelMembers error:", error.message);
    }
    return { data: [], error };
  }

  return { data: data ?? [], error: null };
}

function toProfileMap(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    if (!row?.id) continue;
    map.set(row.id, {
      first_name: row.first_name ?? "",
      last_name: row.last_name ?? "",
    });
  }
  return map;
}

function isPlatformAdmin(req) {
  return String(req.user?.role || "").toLowerCase() === "admin";
}

async function getMembershipForStokvel(client, stokvelId, userId) {
  const { data, error } = await client
    .from("stokvel_members")
    .select("group_role")
    .eq("user_id", userId)
    .eq("stokvel_id", stokvelId)
    .maybeSingle();
  return { data, error };
}

async function resolveGroupAccess({ req, userSupabase, stokvelId }) {
  const platformAdmin = isPlatformAdmin(req);
  const service = getServiceSupabase();
  const reader = platformAdmin ? (service ?? userSupabase) : userSupabase;
  const writer = platformAdmin
    ? (service ?? userSupabase)
    : (service ?? userSupabase);

  if (platformAdmin) {
    return {
      error: null,
      reader,
      writer,
      membership: { group_role: "admin", synthetic: true },
      platformAdmin: true,
    };
  }

  const { data: membership, error } = await getMembershipForStokvel(
    userSupabase,
    stokvelId,
    req.user.id,
  );
  if (error)
    return { error, reader, writer, membership: null, platformAdmin: false };
  if (!membership) {
    return {
      error: new Error("Not found"),
      reader,
      writer,
      membership: null,
      platformAdmin: false,
    };
  }
  return {
    error: null,
    reader,
    writer,
    membership,
    platformAdmin: false,
  };
}

function canManageMeetingsForGroup(membership) {
  return ["admin", "treasurer"].includes(
    String(membership?.group_role || "").toLowerCase(),
  );
}

function requireGroupRole(access, allowedRoles) {
  const role = String(access?.membership?.group_role || "").toLowerCase();
  return allowedRoles.includes(role);
}

function todayIsoSast() {
  const { year, month, day } = zonedYmdParts(new Date());
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function payoutHasHappened(payout, todayIso) {
  const scheduled = String(payout?.scheduled_payout_date ?? "").slice(0, 10);
  if (!scheduled) return false;
  return scheduled < todayIso;
}

function isTreasurer(access) {
  return (
    String(access?.membership?.group_role || "").toLowerCase() === "treasurer"
  );
}
router.get("/", requireAuth, async (req, res) => {
  try {
    const userSupabase = userScopedSupabase(req);

    const { data, error } = await userSupabase
      .from("stokvel_members")
      .select("group_role, stokvels(*)")
      .eq("user_id", req.user.id);

    if (error) {
      sendSupabaseFailure(res, error, "GET /api/stokvels");
      return;
    }

    res.json({ success: true, memberships: data });
  } catch (err) {
    console.error("GET /api/stokvels:", err);
    sendSupabaseFailure(res, err, "GET /api/stokvels");
  }
});

/** Profile search for member invites (two path segments so this never collides with `/:id`). */
router.get("/members/search", requireAuth, searchProfilesForMemberInvite);

/** Treasurer / group admin flags a missed contribution for a member and cycle. */
router.post("/:id/missed-payments", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    if (!UUID_RE_STOKVEL_PARAM.test(String(stokvelId))) {
      return res.status(404).json({ error: "Not found" });
    }

    const { user_id: bodyUserId, target_month: targetMonthRaw } =
      req.body ?? {};
    const targetMonth =
      typeof targetMonthRaw === "string" ? targetMonthRaw.trim() : "";
    if (!TARGET_MONTH_RE.test(targetMonth)) {
      return res
        .status(400)
        .json({ error: "target_month must be a valid YYYY-MM string." });
    }

    const uid =
      typeof bodyUserId === "string" ? bodyUserId.trim().toLowerCase() : "";
    if (!UUID_RE_MEMBER.test(uid)) {
      return res.status(400).json({ error: "Invalid user_id." });
    }

    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!requireGroupRole(access, ["admin", "treasurer"])) {
      return res.status(403).json({
        error: "Only group admin or treasurer can flag missed payments.",
      });
    }

    const { data: targetMember, error: tmErr } = await access.reader
      .from("stokvel_members")
      .select("user_id")
      .eq("stokvel_id", stokvelId)
      .eq("user_id", uid)
      .maybeSingle();

    if (tmErr) {
      sendSupabaseFailure(res, tmErr, "POST missed-payments target member");
      return;
    }
    if (!targetMember?.user_id) {
      return res
        .status(400)
        .json({ error: "User is not a member of this stokvel." });
    }

    const svc = getServiceSupabase();
    if (!svc) {
      return res.status(503).json({
        error:
          "Server configuration error: cannot record flags without service role access.",
      });
    }

    const { error: insErr } = await svc.from("missed_payments").insert([
      {
        stokvel_id: stokvelId,
        user_id: uid,
        target_month: targetMonth,
        flagged_by: req.user.id,
      },
    ]);

    if (insErr) {
      if (insErr.code === "23505") {
        return res.status(200).json({ success: true, alreadyFlagged: true });
      }
      sendSupabaseFailure(res, insErr, "POST missed-payments insert");
      return;
    }

    return res.status(201).json({ success: true, alreadyFlagged: false });
  } catch (err) {
    console.error("POST /api/stokvels/:id/missed-payments:", err);
    sendSupabaseFailure(res, err, "POST /api/stokvels/:id/missed-payments");
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    if (!UUID_RE_STOKVEL_PARAM.test(String(stokvelId))) {
      return res.status(404).json({ error: "Not found" });
    }
    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found")
        return res.status(404).json({ error: "Not found" });
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }

    const { data: stokvel, error: stokvelError } = await access.reader
      .from("stokvels")
      .select("*")
      .eq("id", stokvelId)
      .single();

    if (stokvelError) {
      if (stokvelError.code === "PGRST116") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, stokvelError, "GET /api/stokvels/:id stokvel");
      return;
    }

    const { data: members, error: membersError } = await fetchStokvelMembers(
      access.reader,
      stokvelId,
    );

    if (membersError) {
      sendSupabaseFailure(res, membersError, "GET /api/stokvels/:id members");
      return;
    }

    const { data: contributions, error: contributionsError } =
      await access.reader
        .from("contributions")
        .select(
          "id, amount, paid_at, user_id, target_month, paystack_reference, treasurer_approval_status, treasurer_approved_at, treasurer_approved_by",
        )
        .eq("stokvel_id", stokvelId)
        .order("paid_at", { ascending: false });

    if (contributionsError) {
      sendSupabaseFailure(
        res,
        contributionsError,
        "GET /api/stokvels/:id contributions",
      );
      return;
    }

    const currentCycle = getCurrentPaymentCycle(
      new Date(),
      paymentWindowFromStokvel(stokvel),
    );

    const svc = getServiceSupabase();
    let payouts = [];
    let missedPayments = [];

    if (svc) {
      const { data: payoutRows, error: payoutErr } = await svc
        .from("payouts")
        .select(
          "id, stokvel_id, user_id, target_month, scheduled_payout_date, cycle_index, created_at",
        )
        .eq("stokvel_id", stokvelId);

      if (payoutErr) {
        sendSupabaseFailure(res, payoutErr, "GET /api/stokvels/:id payouts");
        return;
      }
      payouts = (payoutRows ?? []).slice().sort((a, b) => {
        const da = String(a.scheduled_payout_date ?? "");
        const db = String(b.scheduled_payout_date ?? "");
        if (da !== db) return da < db ? -1 : da > db ? 1 : 0;
        return (Number(a.cycle_index) || 0) - (Number(b.cycle_index) || 0);
      });

      const { data: missedRows, error: missedErr } = await svc
        .from("missed_payments")
        .select(
          "id, stokvel_id, user_id, target_month, resolved_at, flagged_by, created_at",
        )
        .eq("stokvel_id", stokvelId)
        .is("resolved_at", null);

      if (missedErr) {
        sendSupabaseFailure(
          res,
          missedErr,
          "GET /api/stokvels/:id missed_payments",
        );
        return;
      }
      missedPayments = missedRows ?? [];
    } else {
      console.warn(
        "GET /api/stokvels/:id: SUPABASE_SERVICE_ROLE_KEY missing; payouts and missed_payments omitted.",
      );
    }

    const contributorIds = [
      ...new Set((contributions ?? []).map((c) => c.user_id).filter(Boolean)),
    ];
    let profileById = new Map();
    if (contributorIds.length > 0) {
      const { data: profileRows, error: profileError } = await access.reader
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", contributorIds);
      if (profileError) {
        sendSupabaseFailure(
          res,
          profileError,
          "GET /api/stokvels/:id contributor profiles",
        );
        return;
      }
      profileById = toProfileMap(profileRows);
    }

    const contributionsWithProfiles = (contributions ?? []).map((c) => ({
      ...c,
      profiles: profileById.get(c.user_id) ?? null,
    }));

    const totalContribution = contributionsWithProfiles.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );

    let fixedPool = null;
    let ratesStale = false;
    if (String(stokvel?.type ?? "") === "Fixed") {
      try {
        const rates = await getMarketRates();
        const prime = rates?.prime?.value;
        fixedPool = computeFixedPoolProjection({
          stokvel,
          contributions: contributionsWithProfiles,
          members: members ?? [],
          primeRate: prime,
          now: new Date(),
        });
        if (!fixedPool) {
          ratesStale = true;
        }
      } catch (rateErr) {
        console.warn(
          "GET /api/stokvels/:id: market rates unavailable for Fixed projection:",
          rateErr?.message ?? rateErr,
        );
        ratesStale = true;
      }
    }

    res.json({
      success: true,
      membership: access.membership,
      stokvel,
      members: members ?? [],
      totalContribution,
      contributions: contributionsWithProfiles,
      currentCycle,
      payouts,
      missedPayments,
      fixedPool,
      rates_stale: ratesStale,
    });
  } catch (err) {
    console.error("GET /api/stokvels/:id:", err);
    sendSupabaseFailure(res, err, "GET /api/stokvels/:id");
  }
});

/** Treasurer-only payout table for disbursement workflow. */
router.get("/:id/payouts", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    if (!UUID_RE_STOKVEL_PARAM.test(String(stokvelId))) {
      return res.status(404).json({ error: "Not found" });
    }

    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!isTreasurer(access)) {
      return res
        .status(403)
        .json({ error: "Only treasurers can access payouts." });
    }

    const svc = getServiceSupabase();
    if (!svc) {
      return res.status(503).json({
        error:
          "Server configuration error: cannot load payouts without service role access.",
      });
    }

    const { data: payoutRows, error: payoutErr } = await svc
      .from("payouts")
      .select(
        "id, stokvel_id, user_id, target_month, scheduled_payout_date, cycle_index, status, disbursed_at, disbursed_by, created_at",
      )
      .eq("stokvel_id", stokvelId);
    if (payoutErr) {
      sendSupabaseFailure(res, payoutErr, "GET /api/stokvels/:id/payouts");
      return;
    }

    const userIds = [
      ...new Set((payoutRows ?? []).map((p) => p.user_id).filter(Boolean)),
    ];
    let profileById = new Map();
    if (userIds.length > 0) {
      const { data: profiles, error: profileErr } = await svc
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);
      if (profileErr) {
        sendSupabaseFailure(
          res,
          profileErr,
          "GET /api/stokvels/:id/payouts profiles",
        );
        return;
      }
      profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    }

    const payouts = (payoutRows ?? [])
      .map((p) => ({
        ...p,
        status:
          String(p.status || "").toLowerCase() === "completed" || p.disbursed_at
            ? "completed"
            : "pending",
        profile: profileById.get(p.user_id) ?? null,
      }))
      .sort((a, b) => {
        const da = String(a.scheduled_payout_date || "");
        const db = String(b.scheduled_payout_date || "");
        if (da !== db) return da < db ? -1 : da > db ? 1 : 0;
        return (Number(a.cycle_index) || 0) - (Number(b.cycle_index) || 0);
      });

    return res.json({ success: true, payouts });
  } catch (err) {
    console.error("GET /api/stokvels/:id/payouts:", err);
    sendSupabaseFailure(res, err, "GET /api/stokvels/:id/payouts");
  }
});

/** Member payout history and upcoming projections. */
router.get("/:id/payout-report", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    if (!UUID_RE_STOKVEL_PARAM.test(String(stokvelId))) {
      return res.status(404).json({ error: "Not found" });
    }

    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      console.error("GET /api/stokvels/:id/payout-report membership:", access.error);
      return res.status(500).json({ error: access.error.message });
    }

    const { data: stokvel, error: stokvelError } = await access.reader
      .from("stokvels")
      .select(
        "id, name, contribution_amount, status, type, cycle_length, created_at, maturity_date",
      )
      .eq("id", stokvelId)
      .single();

    if (stokvelError) {
      console.error("GET /api/stokvels/:id/payout-report stokvel:", stokvelError);
      if (stokvelError.code === "PGRST116") {
        return res.status(404).json({ error: "Not found" });
      }
      return res.status(500).json({ error: stokvelError.message });
    }

    const { data: members, error: membersError } = await fetchStokvelMembers(
      access.reader,
      stokvelId,
    );
    if (membersError) {
      console.error("GET /api/stokvels/:id/payout-report members:", membersError);
      return res.status(500).json({ error: membersError.message });
    }

    const svc = getServiceSupabase();
    if (!svc) {
      return res.status(500).json({
        error:
          "Server configuration error: cannot load payout report without service role access.",
      });
    }

    const { data: payoutRows, error: payoutErr } = await svc
      .from("payouts")
      .select(
        "id, stokvel_id, user_id, target_month, scheduled_payout_date, cycle_index, status, disbursed_at, created_at",
      )
      .eq("stokvel_id", stokvelId);

    if (payoutErr) {
      console.error("GET /api/stokvels/:id/payout-report payouts:", payoutErr);
      return res.status(500).json({ error: payoutErr.message });
    }

    const userIds = [
      ...new Set((payoutRows ?? []).map((p) => p.user_id).filter(Boolean)),
    ];
    let profileById = new Map();
    if (userIds.length > 0) {
      const { data: profiles, error: profileErr } = await svc
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);
      if (profileErr) {
        console.error("GET /api/stokvels/:id/payout-report profiles:", profileErr);
        return res.status(500).json({ error: profileErr.message });
      }
      profileById = toProfileMap(profiles);
    }

    const { data: contributionRows, error: contribErr } = await access.reader
      .from("contributions")
      .select("amount, paid_at, treasurer_approval_status")
      .eq("stokvel_id", stokvelId);

    if (contribErr) {
      console.error(
        "GET /api/stokvels/:id/payout-report contributions:",
        contribErr,
      );
      return res.status(500).json({ error: contribErr.message });
    }

    let fixedPoolProjection = null;
    if (String(stokvel?.type ?? "") === "Fixed") {
      try {
        const rates = await getMarketRates();
        fixedPoolProjection = computeFixedPoolProjection({
          stokvel,
          contributions: contributionRows ?? [],
          members: members ?? [],
          primeRate: rates?.prime?.value,
          now: new Date(),
        });
      } catch (rateErr) {
        console.warn(
          "GET /api/stokvels/:id/payout-report: market rates unavailable:",
          rateErr?.message ?? rateErr,
        );
      }
    }

    const todayIso = todayIsoSast();
    const report = buildPayoutReport({
      stokvel,
      payoutRows: payoutRows ?? [],
      members: members ?? [],
      profileById,
      viewerUserId: req.user.id,
      todayIso,
      fixedPoolProjection,
    });

    return res.json({
      success: true,
      stokvel: {
        id: stokvel.id,
        name: stokvel.name,
        status: stokvel.status,
      },
      today: todayIso,
      report,
    });
  } catch (err) {
    console.error("GET /api/stokvels/:id/payout-report:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/** Treasurer triggers a payout once due and still pending. */
router.post(
  "/:id/payouts/:payoutId/disburse",
  requireAuth,
  async (req, res) => {
    try {
      const stokvelId = req.params.id;
      const payoutId = req.params.payoutId;
      if (!UUID_RE_STOKVEL_PARAM.test(String(stokvelId))) {
        return res.status(404).json({ error: "Not found" });
      }
      if (!UUID_RE_STOKVEL_PARAM.test(String(payoutId))) {
        return res.status(400).json({ error: "Invalid payout id." });
      }

      const userSupabase = userScopedSupabase(req);
      const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
      if (access.error) {
        if (access.error.message === "Not found") {
          return res.status(404).json({ error: "Not found" });
        }
        sendSupabaseFailure(res, access.error, "stokvels");
        return;
      }
      if (!isTreasurer(access)) {
        return res
          .status(403)
          .json({ error: "Only treasurers can disburse payouts." });
      }

      const svc = getServiceSupabase();
      if (!svc) {
        return res.status(503).json({
          error:
            "Server configuration error: cannot disburse payouts without service role access.",
        });
      }

      const { data: payout, error: payoutErr } = await svc
        .from("payouts")
        .select(
          "id, stokvel_id, user_id, target_month, scheduled_payout_date, status, disbursed_at, disbursed_by",
        )
        .eq("id", payoutId)
        .eq("stokvel_id", stokvelId)
        .maybeSingle();
      if (payoutErr) {
        sendSupabaseFailure(
          res,
          payoutErr,
          "POST /api/stokvels/:id/payouts/:payoutId/disburse lookup",
        );
        return;
      }
      if (!payout?.id) {
        return res.status(404).json({ error: "Payout not found." });
      }

      const status = String(payout.status || "").toLowerCase();
      if (status === "completed" || payout.disbursed_at) {
        return res
          .status(409)
          .json({ error: "Payout has already been processed." });
      }

      const todayIso = new Date().toISOString().slice(0, 10);
      const payoutDate = String(payout.scheduled_payout_date || "").slice(
        0,
        10,
      );
      if (!payoutDate) {
        return res.status(400).json({ error: "Payout date is missing." });
      }
      if (todayIso < payoutDate) {
        return res
          .status(400)
          .json({ error: "Payout date has not been reached yet." });
      }

      // TODO: Integrate PSP transfer/disbursement call before marking completed.
      const disbursedAt = new Date().toISOString();
      const { data: updated, error: updateErr } = await svc
        .from("payouts")
        .update({
          status: "completed",
          disbursed_at: disbursedAt,
          disbursed_by: req.user.id,
        })
        .eq("id", payoutId)
        .eq("stokvel_id", stokvelId)
        .select(
          "id, stokvel_id, user_id, target_month, scheduled_payout_date, status, disbursed_at, disbursed_by",
        )
        .maybeSingle();
      if (updateErr) {
        sendSupabaseFailure(
          res,
          updateErr,
          "POST /api/stokvels/:id/payouts/:payoutId/disburse update",
        );
        return;
      }
      if (!updated?.id) {
        return res.status(404).json({ error: "Payout not found." });
      }

      return res.json({ success: true, payout: updated });
    } catch (err) {
      console.error("POST /api/stokvels/:id/payouts/:payoutId/disburse:", err);
      sendSupabaseFailure(
        res,
        err,
        "POST /api/stokvels/:id/payouts/:payoutId/disburse",
      );
    }
  },
);

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    if (!UUID_RE_STOKVEL_PARAM.test(String(stokvelId))) {
      return res.status(404).json({ error: "Not found" });
    }

    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!requireGroupRole(access, ["admin"])) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      name,
      contribution_amount: contributionAmountRaw,
      meeting_frequency: meetingFrequencyRaw,
      is_public: isPublicRaw,
    } = req.body ?? {};

    const patch = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res
          .status(400)
          .json({ error: "name must be a non-empty string." });
      }
      patch.name = name.trim();
    }

    if (contributionAmountRaw !== undefined) {
      const parsed = Number(contributionAmountRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({
          error: "contribution_amount must be a number greater than 0.",
        });
      }
      patch.contribution_amount = parsed;
    }

    if (meetingFrequencyRaw !== undefined) {
      if (
        meetingFrequencyRaw !== "weekly" &&
        meetingFrequencyRaw !== "bi-weekly" &&
        meetingFrequencyRaw !== "monthly"
      ) {
        return res.status(400).json({
          error:
            "meeting_frequency must be one of: weekly, bi-weekly, monthly.",
        });
      }
      patch.meeting_frequency = meetingFrequencyRaw;
    }

    if (isPublicRaw !== undefined) {
      if (typeof isPublicRaw !== "boolean") {
        return res.status(400).json({ error: "is_public must be a boolean." });
      }
      patch.is_public = isPublicRaw;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields provided." });
    }

    const { data: stokvel, error: updateError } = await access.writer
      .from("stokvels")
      .update(patch)
      .eq("id", stokvelId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      sendSupabaseFailure(res, updateError, "PATCH /api/stokvels/:id update");
      return;
    }
    if (!stokvel) return res.status(404).json({ error: "Not found" });

    return res.json({ success: true, stokvel });
  } catch (err) {
    console.error("PATCH /api/stokvels/:id:", err);
    sendSupabaseFailure(res, err, "PATCH /api/stokvels/:id");
  }
});

router.get("/:id/meetings", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found")
        return res.status(404).json({ error: "Not found" });
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }

    const { data, error } = await access.reader
      .from("meetings")
      .select(
        "id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at",
      )
      .eq("stokvel_id", stokvelId)
      .order("meeting_date", { ascending: true });
    if (error) {
      sendSupabaseFailure(res, error, "GET /api/stokvels/:id/meetings");
      return;
    }

    return res.json({ success: true, meetings: data ?? [] });
  } catch (err) {
    console.error("GET /api/stokvels/:id/meetings:", err);
    sendSupabaseFailure(res, err, "GET /api/stokvels/:id/meetings");
  }
});

router.post("/:id/meetings", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!canManageMeetingsForGroup(access.membership)) {
      return res
        .status(403)
        .json({ error: "Only admin or treasurer can schedule meetings." });
    }

    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const meetingDate =
      typeof req.body?.meetingDate === "string"
        ? req.body.meetingDate.trim()
        : "";
    const meetingLink =
      typeof req.body?.meetingLink === "string"
        ? req.body.meetingLink.trim()
        : "";
    const agenda =
      typeof req.body?.agenda === "string" ? req.body.agenda.trim() : "";
    if (!title || !meetingDate) {
      return res
        .status(400)
        .json({ error: "Title and meeting date are required." });
    }

    const { data: created, error: createError } = await access.writer
      .from("meetings")
      .insert({
        stokvel_id: stokvelId,
        title,
        meeting_date: meetingDate,
        meeting_link: meetingLink || null,
        agenda: agenda || null,
        notes: agenda || null,
        created_by: req.user.id,
      })
      .select(
        "id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at",
      )
      .single();
    if (createError) {
      sendSupabaseFailure(res, createError, "POST /api/stokvels/:id/meetings");
      return;
    }

    const { data: stokvel } = await userSupabase
      .from("stokvels")
      .select("name")
      .eq("id", stokvelId)
      .maybeSingle();

    const { data: memberRows } = await userSupabase
      .from("stokvel_members")
      .select("user_id")
      .eq("stokvel_id", stokvelId);

    const memberIds = [
      ...new Set((memberRows ?? []).map((m) => m.user_id).filter(Boolean)),
    ];
    if (memberIds.length > 0) {
      const svc = getServiceSupabase();
      const profileClient = svc ?? userSupabase;
      if (!svc) {
        console.warn(
          "[meetings] SUPABASE_SERVICE_ROLE_KEY missing; profile emails use the caller token and may be incomplete under RLS.",
        );
      }
      const { data: profiles, error: profilesEmailErr } = await profileClient
        .from("profiles")
        .select("id, email")
        .in("id", memberIds);
      if (profilesEmailErr) {
        console.error(
          "POST /api/stokvels/:id/meetings profile emails:",
          profilesEmailErr,
        );
      }
      const recipients = [
        ...new Set(
          (profiles ?? [])
            .map((p) => normalizeInviteEmail(p.email))
            .filter(Boolean),
        ),
      ];
      console.log("[meetings] meeting notification profile emails", {
        stokvelId,
        meetingId: created.id,
        members: (profiles ?? []).map((p) => ({
          userId: p.id,
          profileEmail: p.email ?? null,
        })),
        recipients,
      });
      await Promise.all(
        recipients.map((to) =>
          sendMeetingScheduledEmail({
            to,
            groupName: stokvel?.name || "Your stokvel",
            title: created.title,
            meetingDate: created.meeting_date,
            meetingLink: created.meeting_link,
            agenda: created.agenda || created.notes || "",
          }),
        ),
      );
    }

    return res.status(201).json({ success: true, meeting: created });
  } catch (err) {
    console.error("POST /api/stokvels/:id/meetings:", err);
    sendSupabaseFailure(res, err, "POST /api/stokvels/:id/meetings");
  }
});

router.patch("/:id/meetings/:meetingId", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    const meetingId = req.params.meetingId;
    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!canManageMeetingsForGroup(access.membership)) {
      return res
        .status(403)
        .json({ error: "Only admin or treasurer can edit meetings." });
    }

    const patch = {};
    if (typeof req.body?.title === "string")
      patch.title = req.body.title.trim();
    if (typeof req.body?.meetingDate === "string")
      patch.meeting_date = req.body.meetingDate.trim();
    if (typeof req.body?.meetingLink === "string")
      patch.meeting_link = req.body.meetingLink.trim() || null;
    if (typeof req.body?.agenda === "string") {
      patch.agenda = req.body.agenda.trim() || null;
      patch.notes = req.body.agenda.trim() || null;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields provided." });
    }
    patch.updated_at = new Date().toISOString();

    const { data, error } = await access.writer
      .from("meetings")
      .update(patch)
      .eq("id", meetingId)
      .eq("stokvel_id", stokvelId)
      .select(
        "id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at",
      )
      .maybeSingle();
    if (error) {
      sendSupabaseFailure(
        res,
        error,
        "PATCH /api/stokvels/:id/meetings/:meetingId",
      );
      return;
    }
    if (!data) return res.status(404).json({ error: "Meeting not found." });

    return res.json({ success: true, meeting: data });
  } catch (err) {
    console.error("PATCH /api/stokvels/:id/meetings/:meetingId:", err);
    sendSupabaseFailure(
      res,
      err,
      "PATCH /api/stokvels/:id/meetings/:meetingId",
    );
  }
});

router.patch(
  "/:id/meetings/:meetingId/minutes",
  requireAuth,
  async (req, res) => {
    try {
      const stokvelId = req.params.id;
      const meetingId = req.params.meetingId;
      const userSupabase = userScopedSupabase(req);
      const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
      if (access.error) {
        if (access.error.message === "Not found") {
          return res.status(404).json({ error: "Not found" });
        }
        sendSupabaseFailure(res, access.error, "stokvels");
        return;
      }
      if (!canManageMeetingsForGroup(access.membership)) {
        return res
          .status(403)
          .json({ error: "Only admin or treasurer can record minutes." });
      }

      const minutes =
        typeof req.body?.minutes === "string" ? req.body.minutes.trim() : "";
      const { data, error } = await access.writer
        .from("meetings")
        .update({
          minutes: minutes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", meetingId)
        .eq("stokvel_id", stokvelId)
        .select(
          "id, stokvel_id, title, meeting_date, notes, meeting_link, agenda, minutes, created_at",
        )
        .maybeSingle();
      if (error) {
        sendSupabaseFailure(
          res,
          error,
          "PATCH /api/stokvels/:id/meetings/:meetingId/minutes",
        );
        return;
      }
      if (!data) return res.status(404).json({ error: "Meeting not found." });

      return res.json({ success: true, meeting: data });
    } catch (err) {
      console.error(
        "PATCH /api/stokvels/:id/meetings/:meetingId/minutes:",
        err,
      );
      sendSupabaseFailure(
        res,
        err,
        "PATCH /api/stokvels/:id/meetings/:meetingId/minutes",
      );
    }
  },
);

router.delete("/:id/meetings/:meetingId", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    const meetingId = req.params.meetingId;
    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!canManageMeetingsForGroup(access.membership)) {
      return res.status(403).json({
        error: "Only this group admin or treasurer can delete meetings.",
      });
    }

    const { data, error } = await access.writer
      .from("meetings")
      .delete()
      .eq("id", meetingId)
      .eq("stokvel_id", stokvelId)
      .select("id")
      .maybeSingle();
    if (error) {
      sendSupabaseFailure(
        res,
        error,
        "DELETE /api/stokvels/:id/meetings/:meetingId",
      );
      return;
    }
    if (!data) return res.status(404).json({ error: "Meeting not found." });
    return res.json({ success: true, meetingId });
  } catch (err) {
    console.error("DELETE /api/stokvels/:id/meetings/:meetingId:", err);
    sendSupabaseFailure(
      res,
      err,
      "DELETE /api/stokvels/:id/meetings/:meetingId",
    );
  }
});

router.patch("/:id/treasurer", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    const targetUserId =
      typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    if (!targetUserId) {
      return res.status(400).json({ error: "Target user is required." });
    }

    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!requireGroupRole(access, ["admin", "treasurer"])) {
      return res
        .status(403)
        .json({ error: "Only an admin or treasurer can change treasurer." });
    }

    const { data: targetMembership, error: targetMembershipError } =
      await userSupabase
        .from("stokvel_members")
        .select("user_id")
        .eq("stokvel_id", stokvelId)
        .eq("user_id", targetUserId)
        .maybeSingle();

    if (targetMembershipError) {
      sendSupabaseFailure(
        res,
        targetMembershipError,
        "PATCH /api/stokvels/:id/treasurer target member",
      );
      return;
    }
    if (!targetMembership) {
      return res
        .status(400)
        .json({ error: "Selected user is not a member of this stokvel." });
    }

    const { error: demoteError } = await access.writer
      .from("stokvel_members")
      .update({ group_role: "member" })
      .eq("stokvel_id", stokvelId)
      .eq("group_role", "treasurer")
      .neq("user_id", targetUserId);
    if (demoteError) {
      sendSupabaseFailure(
        res,
        demoteError,
        "PATCH /api/stokvels/:id/treasurer demote",
      );
      return;
    }

    const { error: assignError } = await access.writer
      .from("stokvel_members")
      .update({ group_role: "treasurer" })
      .eq("stokvel_id", stokvelId)
      .eq("user_id", targetUserId);
    if (assignError) {
      sendSupabaseFailure(
        res,
        assignError,
        "PATCH /api/stokvels/:id/treasurer assign",
      );
      return;
    }

    return res.json({ success: true, userId: targetUserId });
  } catch (err) {
    console.error("PATCH /api/stokvels/:id/treasurer:", err);
    sendSupabaseFailure(res, err, "PATCH /api/stokvels/:id/treasurer");
  }
});

router.patch("/:id/payout-order", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    if (!UUID_RE_STOKVEL_PARAM.test(String(stokvelId))) {
      return res.status(404).json({ error: "Not found" });
    }

    const orderedUpcomingPayoutIds = Array.isArray(
      req.body?.orderedUpcomingPayoutIds,
    )
      ? req.body.orderedUpcomingPayoutIds.filter(
          (v) => typeof v === "string" && v.trim(),
        )
      : null;
    if (!orderedUpcomingPayoutIds) {
      return res
        .status(400)
        .json({ error: "orderedUpcomingPayoutIds must be a non-empty array." });
    }

    const userSupabase = userScopedSupabase(req);
    const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
    if (access.error) {
      if (access.error.message === "Not found") {
        return res.status(404).json({ error: "Not found" });
      }
      sendSupabaseFailure(res, access.error, "stokvels");
      return;
    }
    if (!requireGroupRole(access, ["admin", "treasurer"])) {
      return res.status(403).json({
        error: "Only an admin or treasurer can reorder payouts.",
      });
    }

    const svc = getServiceSupabase();
    if (!svc) {
      return res.status(503).json({
        error:
          "Server configuration error: cannot reorder payouts without service role access.",
      });
    }

    const { data: payoutRows, error: payoutErr } = await svc
      .from("payouts")
      .select(
        "id, stokvel_id, user_id, target_month, scheduled_payout_date, cycle_index, created_at",
      )
      .eq("stokvel_id", stokvelId);
    if (payoutErr) {
      sendSupabaseFailure(
        res,
        payoutErr,
        "PATCH /api/stokvels/:id/payout-order list",
      );
      return;
    }

    const sortedPayouts = (payoutRows ?? []).slice().sort((a, b) => {
      const da = String(a.scheduled_payout_date ?? "");
      const db = String(b.scheduled_payout_date ?? "");
      if (da !== db) return da < db ? -1 : 1;
      return (Number(a.cycle_index) || 0) - (Number(b.cycle_index) || 0);
    });

    const todayIso = todayIsoSast();
    const upcoming = sortedPayouts.filter(
      (p) => !payoutHasHappened(p, todayIso),
    );
    if (upcoming.length <= 1) {
      return res.status(400).json({
        error: "There are not enough upcoming payouts to reorder.",
      });
    }

    const upcomingIds = upcoming.map((p) => String(p.id));
    if (orderedUpcomingPayoutIds.length !== upcomingIds.length) {
      return res.status(400).json({
        error:
          "orderedUpcomingPayoutIds must include each upcoming payout exactly once.",
      });
    }
    const expected = new Set(upcomingIds);
    const proposed = new Set(orderedUpcomingPayoutIds);
    if (proposed.size !== orderedUpcomingPayoutIds.length) {
      return res
        .status(400)
        .json({ error: "orderedUpcomingPayoutIds contains duplicates." });
    }
    for (const id of orderedUpcomingPayoutIds) {
      if (!expected.has(String(id))) {
        return res.status(400).json({
          error:
            "orderedUpcomingPayoutIds contains payouts that are not upcoming.",
        });
      }
    }

    const upcomingById = new Map(upcoming.map((p) => [String(p.id), p]));
    const reorderedUpcoming = orderedUpcomingPayoutIds.map((id) =>
      upcomingById.get(String(id)),
    );

    for (let i = 0; i < upcoming.length; i += 1) {
      const originalSlot = upcoming[i];
      const incoming = reorderedUpcoming[i];
      if (!originalSlot?.id || !incoming?.user_id) continue;
      const { error: updErr } = await svc
        .from("payouts")
        .update({ user_id: incoming.user_id })
        .eq("id", originalSlot.id)
        .eq("stokvel_id", stokvelId);
      if (updErr) {
        sendSupabaseFailure(
          res,
          updErr,
          "PATCH /api/stokvels/:id/payout-order update",
        );
        return;
      }
    }

    const { data: refreshedRows, error: refreshErr } = await svc
      .from("payouts")
      .select(
        "id, stokvel_id, user_id, target_month, scheduled_payout_date, cycle_index, created_at",
      )
      .eq("stokvel_id", stokvelId);
    if (refreshErr) {
      sendSupabaseFailure(
        res,
        refreshErr,
        "PATCH /api/stokvels/:id/payout-order refresh",
      );
      return;
    }

    const payouts = (refreshedRows ?? []).slice().sort((a, b) => {
      const da = String(a.scheduled_payout_date ?? "");
      const db = String(b.scheduled_payout_date ?? "");
      if (da !== db) return da < db ? -1 : 1;
      return (Number(a.cycle_index) || 0) - (Number(b.cycle_index) || 0);
    });

    return res.json({ success: true, payouts });
  } catch (err) {
    console.error("PATCH /api/stokvels/:id/payout-order:", err);
    sendSupabaseFailure(res, err, "PATCH /api/stokvels/:id/payout-order");
  }
});

router.post("/:id/contributions", requireAuth, async (req, res) => {
  try {
    const stokvelId = req.params.id;
    const { amount } = req.body;
    const parsed = Number(amount);

    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: "A valid amount is required" });
    }

    const userSupabase = userScopedSupabase(req);

    // Verify user is a member
    const { data: membership, error: membershipError } = await userSupabase
      .from("stokvel_members")
      .select("group_role")
      .eq("user_id", req.user.id)
      .eq("stokvel_id", stokvelId)
      .maybeSingle();

    if (membershipError) {
      sendSupabaseFailure(
        res,
        membershipError,
        "POST contributions membership lookup",
      );
      return;
    }
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this stokvel" });
    }

    const { data, error } = await userSupabase
      .from("contributions")
      .insert([{ stokvel_id: stokvelId, user_id: req.user.id, amount: parsed }])
      .select()
      .single();

    if (error) {
      sendSupabaseFailure(res, error, "POST contributions insert");
      return;
    }

    res.status(201).json({ success: true, contribution: data });
  } catch (err) {
    console.error("POST contributions:", err);
    sendSupabaseFailure(res, err, "POST /api/stokvels/:id/contributions");
  }
});

// POST /api/stokvels/:id/payments/verify
router.post("/:id/payments/verify", requireAuth, async (req, res) => {
  try {
    const { reference } = req.body ?? {};
    const user_id = req.user.id;
    console.log("[VERIFY] === Payment verify started ===");
    console.log(
      "[VERIFY] reference:",
      reference,
      "user_id:",
      user_id,
      "stokvel_id:",
      req.params.id,
    );

    if (!reference || typeof reference !== "string" || !reference.trim()) {
      return res.status(400).json({ error: "Payment reference is required." });
    }

    const rawId =
      typeof req.params?.id === "string" ? req.params.id.trim() : "";
    const stokvel_id = UUID_RE_STOKVEL_PARAM.test(rawId)
      ? rawId.toLowerCase()
      : null;

    if (!stokvel_id) {
      return res.status(400).json({ error: "Invalid stokvel id." });
    }

    const paystackRef = reference.trim();

    const svc = getServiceSupabase();
    if (!svc) {
      return res.status(503).json({
        error:
          "Server configuration error: cannot verify payments without service role access.",
      });
    }

    const { data: existingRef, error: dupLookupErr } = await svc
      .from("contributions")
      .select("id")
      .eq("paystack_reference", paystackRef)
      .maybeSingle();

    if (dupLookupErr) {
      sendSupabaseFailure(
        res,
        dupLookupErr,
        "POST payments/verify dup lookup",
      );
      return;
    }
    if (existingRef?.id) {
      return res
        .status(409)
        .json({ error: "This payment reference was already recorded." });
    }

    let paystackResponse;
    try {
      paystackResponse = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(paystackRef)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );
    } catch (verifyErr) {
      const paystackMessage =
        verifyErr?.response?.data?.message ||
        verifyErr?.message ||
        "Paystack verification failed";
      console.error("POST payments/verify paystack error:", paystackMessage);
      return res
        .status(502)
        .json({ error: `Paystack verify failed: ${paystackMessage}` });
    }
    const { data } = paystackResponse;
    console.log(
      "[VERIFY] Paystack response status:",
      data?.data?.status,
      "amount:",
      data?.data?.amount,
    );

    if (data?.data?.status !== "success") {
      console.log("[VERIFY] REJECTED: Paystack status is not 'success'");
      return res.status(400).json({ error: "Payment not successful" });
    }

    const tx = data.data;
    const verified_amount = tx.amount / 100;

    const paidRaw = tx.paid_at ?? tx.paidAt;
    let paidAt;
    if (paidRaw == null) {
      paidAt = new Date();
    } else if (typeof paidRaw === "number") {
      paidAt = new Date(paidRaw * 1000);
    } else {
      paidAt = new Date(paidRaw);
    }
    if (Number.isNaN(paidAt.getTime())) {
      return res.status(502).json({
        error: "Paystack response missing a valid paid_at timestamp.",
      });
    }

    const { data: stokvel, error: stErr } = await svc
      .from("stokvels")
      .select(
        "id, type, status, payment_window_start_day, payment_window_end_day",
      )
      .eq("id", stokvel_id)
      .maybeSingle();

    if (stErr) {
      sendSupabaseFailure(res, stErr, "POST payments/verify stokvel");
      return;
    }
    if (!stokvel?.id || stokvel.status !== "active") {
      return res
        .status(400)
        .json({ error: "Stokvel is not active or was not found." });
    }

    const payWindow = paymentWindowFromStokvel(stokvel);
    const targetMonth = getTargetMonthForPaidAt(paidAt, payWindow);
    console.log(
      "[VERIFY] paidAt:",
      paidAt.toISOString(),
      "targetMonth:",
      targetMonth,
    );
    if (!targetMonth) {
      console.log("[VERIFY] REJECTED: Could not derive target_month");
      return res
        .status(400)
        .json({ error: "Could not derive contribution cycle (target_month)." });
    }

    const { data: membership, error: memErr } = await svc
      .from("stokvel_members")
      .select("user_id")
      .eq("stokvel_id", stokvel_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (memErr) {
      sendSupabaseFailure(res, memErr, "POST payments/verify membership");
      return;
    }
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this stokvel." });
    }

    const inWindow = isPaidAtInWindowForTargetMonth(
      paidAt,
      targetMonth,
      payWindow,
    );
    console.log("[VERIFY] inPaymentWindow:", inWindow);
    if (!inWindow) {
      const { data: missedRows, error: missErr } = await svc
        .from("missed_payments")
        .select("id")
        .eq("stokvel_id", stokvel_id)
        .eq("user_id", user_id)
        .is("resolved_at", null)
        .limit(1);

      if (missErr) {
        sendSupabaseFailure(
          res,
          missErr,
          "POST payments/verify missed_payments",
        );
        return;
      }
      console.log(
        "[VERIFY] missedPayment flags found:",
        missedRows?.length ?? 0,
      );
      if (!Array.isArray(missedRows) || missedRows.length === 0) {
        console.log(
          "[VERIFY] REJECTED: outside window and no missed-payment flag",
        );
        return res.status(403).json({
          error:
            "Payment is outside the valid window for this cycle, and no open missed-payment flag was found.",
        });
      }
    }

    if (String(stokvel.type) === "Rotating") {
      const { data: recvRow, error: recvErr } = await svc
        .from("payouts")
        .select("id")
        .eq("stokvel_id", stokvel_id)
        .eq("target_month", targetMonth)
        .eq("user_id", user_id)
        .maybeSingle();

      if (recvErr) {
        sendSupabaseFailure(res, recvErr, "POST payments/verify payouts");
        return;
      }
      if (recvRow?.id) {
        return res.status(403).json({
          error:
            "You are the scheduled payout receiver for this cycle and cannot record a contribution for it.",
        });
      }
    }

    console.log("[VERIFY] Inserting contribution:", {
      stokvel_id,
      user_id,
      amount: verified_amount,
      paid_at: paidAt.toISOString(),
      target_month: targetMonth,
      paystack_reference: paystackRef,
    });
    const { data: contribution, error: insErr } = await svc
      .from("contributions")
      .insert([
        {
          stokvel_id,
          user_id,
          amount: verified_amount,
          paid_at: paidAt.toISOString(),
          target_month: targetMonth,
          paystack_reference: paystackRef,
        },
      ])
      .select(
        "id, stokvel_id, user_id, amount, paid_at, target_month, paystack_reference, treasurer_approval_status, treasurer_approved_at, treasurer_approved_by",
      )
      .single();

    if (insErr) {
      const msg = String(insErr.message || insErr);
      console.error("[VERIFY] INSERT FAILED:", insErr.code, msg);
      if (msg.includes("duplicate") || insErr.code === "23505") {
        return res
          .status(409)
          .json({ error: "This payment reference was already recorded." });
      }
      sendSupabaseFailure(res, insErr, "POST payments/verify insert");
      return;
    }
    console.log(
      "[VERIFY] SUCCESS: contribution inserted, id:",
      contribution?.id,
    );

    const { error: resolveErr } = await svc
      .from("missed_payments")
      .update({ resolved_at: new Date().toISOString() })
      .eq("stokvel_id", stokvel_id)
      .eq("user_id", user_id)
      .eq("target_month", targetMonth)
      .is("resolved_at", null);

    if (resolveErr) {
      console.error(
        "POST payments/verify missed_payments resolve:",
        resolveErr,
      );
    }

    return res.json({ success: true, contribution });
  } catch (err) {
    console.error("POST payments/verify:", err);
    sendSupabaseFailure(res, err, "POST payments/verify");
  }
});

router.patch(
  "/:id/contributions/:contributionId/treasurer-approval",
  requireAuth,
  async (req, res) => {
    try {
      const stokvelId = req.params.id;
      const contributionId = req.params.contributionId;
      if (
        !UUID_RE_STOKVEL_PARAM.test(String(stokvelId)) ||
        !UUID_RE_MEMBER.test(String(contributionId).trim().toLowerCase())
      ) {
        return res.status(404).json({ error: "Not found" });
      }
      const cid = String(contributionId).trim().toLowerCase();

      const statusRaw =
        typeof req.body?.status === "string"
          ? req.body.status.trim().toLowerCase()
          : "";
      if (
        statusRaw !== "approved" &&
        statusRaw !== "rejected" &&
        statusRaw !== "pending"
      ) {
        return res.status(400).json({
          error: 'status must be "approved", "rejected", or "pending".',
        });
      }

      const userSupabase = userScopedSupabase(req);
      const access = await resolveGroupAccess({ req, userSupabase, stokvelId });
      if (access.error) {
        if (access.error.message === "Not found") {
          return res.status(404).json({ error: "Not found" });
        }
        sendSupabaseFailure(res, access.error, "stokvels");
        return;
      }
      if (!requireGroupRole(access, ["admin", "treasurer"])) {
        return res.status(403).json({
          error: "Only group admin or treasurer can confirm payments.",
        });
      }

      const writer = access.writer;
      const { data: row, error: fetchErr } = await writer
        .from("contributions")
        .select("id, stokvel_id, user_id, target_month, paid_at")
        .eq("id", cid)
        .eq("stokvel_id", stokvelId)
        .maybeSingle();

      if (fetchErr) {
        sendSupabaseFailure(
          res,
          fetchErr,
          "PATCH treasurer-approval fetch contribution",
        );
        return;
      }
      if (!row?.id) {
        return res.status(404).json({ error: "Contribution not found." });
      }
      if (!row.paid_at) {
        return res
          .status(400)
          .json({ error: "Only recorded payments can be confirmed." });
      }

      const nowIso = new Date().toISOString();
      const approvalPatch =
        statusRaw === "pending"
          ? {
              treasurer_approval_status: "pending",
              treasurer_approved_at: null,
              treasurer_approved_by: null,
            }
          : {
              treasurer_approval_status: statusRaw,
              treasurer_approved_at: nowIso,
              treasurer_approved_by: req.user.id,
            };

      const { data: updated, error: updErr } = await writer
        .from("contributions")
        .update(approvalPatch)
        .eq("id", cid)
        .eq("stokvel_id", stokvelId)
        .select(
          "id, amount, paid_at, user_id, target_month, paystack_reference, treasurer_approval_status, treasurer_approved_at, treasurer_approved_by",
        )
        .maybeSingle();

      if (updErr) {
        sendSupabaseFailure(
          res,
          updErr,
          "PATCH treasurer-approval update contribution",
        );
        return;
      }
      if (!updated?.id) {
        return res.status(404).json({ error: "Contribution not found." });
      }

      let profiles = null;
      if (updated.user_id) {
        const { data: prof } = await access.reader
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("id", updated.user_id)
          .maybeSingle();
        if (prof) profiles = prof;
      }

      return res.json({
        success: true,
        contribution: { ...updated, profiles },
      });
    } catch (err) {
      console.error(
        "PATCH /api/stokvels/:id/contributions/:contributionId/treasurer-approval:",
        err,
      );
      sendSupabaseFailure(
        res,
        err,
        "PATCH /api/stokvels/:id/contributions/:contributionId/treasurer-approval",
      );
    }
  },
);

export default router;
