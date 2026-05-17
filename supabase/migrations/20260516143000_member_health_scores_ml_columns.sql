-- ML-powered health score metadata (confidence + model version).
-- Table member_health_scores is created in 20260515140000_member_health_scores.sql

ALTER TABLE public.member_health_scores
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(5, 2);

ALTER TABLE public.member_health_scores
  ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'v1';

COMMENT ON COLUMN public.member_health_scores.confidence IS 'Classifier certainty for predicted grade (0-100).';
COMMENT ON COLUMN public.member_health_scores.model_version IS 'ML model tag (e.g. v1, fallback, nodata).';
