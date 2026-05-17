// TO REGISTER: In your main Express app file, add:
// import healthScoreRoutes from './routes/healthScore.js';
// app.use('/api/members', healthScoreRoutes);

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getServiceSupabase } from "../utils/supabaseAdmin.js";
import { calculateHealthScore } from "../services/healthScoreService.js";

const router = Router();

const UUID_PARAM =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function computeAndUpsert(req, res) {
  try {
    const tokenUserId = String(req.user?.id ?? "").toLowerCase();
    const paramUserId = String(req.params.userId ?? "").trim().toLowerCase();

    if (!UUID_PARAM.test(paramUserId)) {
      return res.status(400).json({ error: "Invalid user id." });
    }

    if (tokenUserId !== paramUserId) {
      return res
        .status(403)
        .json({ error: "You can only access your own health score." });
    }

    const groupIdRaw = req.query?.groupId;
    const groupId =
      typeof groupIdRaw === "string" ? groupIdRaw.trim().toLowerCase() : "";

    if (!groupId) {
      return res.status(400).json({
        error:
          "groupId query parameter is required (your active stokvel id — table `stokvels.id`).",
      });
    }

    if (!UUID_PARAM.test(groupId)) {
      return res.status(400).json({ error: "Invalid groupId." });
    }

    const svc = getServiceSupabase();
    if (!svc) {
      return res.status(503).json({
        error:
          "Server configuration error: cannot calculate health scores without service role access.",
      });
    }

    const { data: membership, error: membershipErr } = await svc
      .from("stokvel_members")
      .select("user_id")
      .eq("stokvel_id", groupId)
      .eq("user_id", paramUserId)
      .maybeSingle();

    if (membershipErr) {
      console.error("health-score membership:", membershipErr);
      return res.status(500).json({ error: membershipErr.message });
    }
    if (!membership?.user_id) {
      return res.status(404).json({
        error: "You are not a member of this group.",
      });
    }

    const { row, meta } = await calculateHealthScore(
      paramUserId,
      groupId,
      svc,
    );

    const { error: upsertErr } = await svc.from("member_health_scores").upsert(
      row,
      { onConflict: "user_id,group_id" },
    );

    if (upsertErr) {
      console.error("health-score upsert:", upsertErr);
      return res.status(500).json({ error: upsertErr.message });
    }

    return res.json({
      success: true,
      score: row.score,
      grade: row.grade,
      confidence: row.confidence,
      model_version: row.model_version,
      on_time_rate: row.on_time_rate,
      missed_payments: row.missed_payments,
      avg_days_late: row.avg_days_late,
      streak_months: row.streak_months,
      engagement_score: row.engagement_score,
      last_calculated_at: row.last_calculated_at,
      lowConfidence: meta.lowConfidence,
      insufficientData: meta.insufficientData,
      summaryLine: meta.summaryLine,
      onTimeMonths: meta.onTimeMonths,
      totalTrackedMonths: meta.totalTrackedMonths,
      feature_importances: meta.feature_importances,
      note: meta.note,
    });
  } catch (err) {
    console.error("health-score route:", err);
    return res.status(500).json({
      error: err?.message || "Internal Server Error",
    });
  }
}

router.get("/:userId/health-score", requireAuth, computeAndUpsert);

router.post("/:userId/health-score/refresh", requireAuth, computeAndUpsert);

export default router;
