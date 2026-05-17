-- Cached member financial health scores (computed server-side with service role).

CREATE TABLE IF NOT EXISTS public.member_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL,
  grade TEXT NOT NULL,
  on_time_rate NUMERIC(5, 2),
  missed_payments INT,
  avg_days_late NUMERIC(6, 2),
  streak_months INT,
  engagement_score NUMERIC(5, 2),
  last_calculated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  CONSTRAINT member_health_scores_user_group UNIQUE (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS member_health_scores_group_idx
  ON public.member_health_scores (group_id);

COMMENT ON TABLE public.member_health_scores IS 'Per-member reliability score per stokvel (group_id = stokvels.id).';

ALTER TABLE public.member_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_own_score"
ON public.member_health_scores FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "service_role_upsert_scores"
ON public.member_health_scores FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
