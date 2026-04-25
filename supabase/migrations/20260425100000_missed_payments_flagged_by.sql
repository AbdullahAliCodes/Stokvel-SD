-- Record who flagged a missed payment (treasurer/admin flow).
ALTER TABLE public.missed_payments
  ADD COLUMN IF NOT EXISTS flagged_by uuid;

COMMENT ON COLUMN public.missed_payments.flagged_by IS 'User id (auth) of the admin or treasurer who created the flag.';
