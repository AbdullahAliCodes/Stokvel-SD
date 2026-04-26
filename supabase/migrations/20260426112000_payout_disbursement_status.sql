-- Payout execution state for treasurer-triggered disbursements.

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS disbursed_at timestamptz,
  ADD COLUMN IF NOT EXISTS disbursed_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payouts_status_check'
      AND conrelid = 'public.payouts'::regclass
  ) THEN
    ALTER TABLE public.payouts
      ADD CONSTRAINT payouts_status_check
      CHECK (status IN ('pending', 'completed'));
  END IF;
END $$;

UPDATE public.payouts
SET status = 'completed'
WHERE status = 'pending'
  AND disbursed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS payouts_stokvel_status_payout_date_idx
  ON public.payouts (stokvel_id, status, scheduled_payout_date);
