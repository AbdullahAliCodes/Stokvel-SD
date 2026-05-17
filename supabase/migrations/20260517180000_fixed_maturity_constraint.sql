-- Pivot: Investment → Fixed; enforce maturity_date on Fixed stokvels only.

UPDATE public.stokvels
SET type = 'Fixed'
WHERE type = 'Investment';

ALTER TABLE public.stokvels
  DROP CONSTRAINT IF EXISTS stokvels_investment_maturity_required;

ALTER TABLE public.stokvels
  ADD CONSTRAINT stokvels_fixed_maturity_required
    CHECK (
      type IS DISTINCT FROM 'Fixed'
      OR maturity_date IS NOT NULL
    );

COMMENT ON CONSTRAINT stokvels_fixed_maturity_required ON public.stokvels IS
  'Fixed (interest pool) groups must declare maturity_date for bulk payout scheduling.';
