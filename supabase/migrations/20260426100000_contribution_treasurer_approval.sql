-- Treasurer bank confirmation for recorded (paid) contributions.

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS treasurer_approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS treasurer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS treasurer_approved_by uuid;

ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_treasurer_approval_status_check;

ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_treasurer_approval_status_check
  CHECK (treasurer_approval_status IN ('pending', 'approved', 'rejected'));

COMMENT ON COLUMN public.contributions.treasurer_approval_status IS 'pending | approved | rejected — treasurer verified funds in bank.';
COMMENT ON COLUMN public.contributions.treasurer_approved_at IS 'When the treasurer last set approval status.';
COMMENT ON COLUMN public.contributions.treasurer_approved_by IS 'Profile/user id of treasurer (or admin) who confirmed.';
