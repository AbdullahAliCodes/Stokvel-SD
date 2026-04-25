-- Payment cycles (SAST windows), explicit payouts, contribution idempotency, missed payments.

ALTER TABLE public.stokvels
  ADD COLUMN IF NOT EXISTS payout_order_type text DEFAULT 'randomize',
  ADD COLUMN IF NOT EXISTS proposed_payout_sequence jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payout_sequence jsonb;

COMMENT ON COLUMN public.stokvels.payout_order_type IS 'randomize | manual — frozen sequence locked at activation.';
COMMENT ON COLUMN public.stokvels.proposed_payout_sequence IS 'JSON array of user UUIDs in proposed payout order while pending.';
COMMENT ON COLUMN public.stokvels.payout_sequence IS 'JSON array of user UUIDs locked when the stokvel becomes active.';

UPDATE public.stokvels
SET payout_order_type = CASE
  WHEN lower(trim(payout_order)) = 'manual' THEN 'manual'
  ELSE 'randomize'
END
WHERE payout_order IS NOT NULL
  AND payout_order <> ''
  AND (payout_order_type IS NULL OR payout_order_type = 'randomize');

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id uuid NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  target_month text NOT NULL,
  scheduled_payout_date date NOT NULL,
  cycle_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT payouts_stokvel_user_month UNIQUE (stokvel_id, user_id, target_month)
);

CREATE INDEX IF NOT EXISTS payouts_stokvel_target_month_idx
  ON public.payouts (stokvel_id, target_month);

CREATE TABLE IF NOT EXISTS public.missed_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id uuid NOT NULL REFERENCES public.stokvels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  target_month text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT missed_payments_stokvel_user_month UNIQUE (stokvel_id, user_id, target_month)
);

CREATE INDEX IF NOT EXISTS missed_payments_unresolved_idx
  ON public.missed_payments (stokvel_id, user_id)
  WHERE resolved_at IS NULL;

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS target_month text,
  ADD COLUMN IF NOT EXISTS paystack_reference text;

CREATE UNIQUE INDEX IF NOT EXISTS contributions_paystack_reference_uidx
  ON public.contributions (paystack_reference)
  WHERE paystack_reference IS NOT NULL;
