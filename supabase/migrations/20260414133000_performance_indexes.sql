-- Speed up common membership lookups by user + group.
CREATE INDEX IF NOT EXISTS stokvel_members_user_stokvel_idx
ON public.stokvel_members (user_id, stokvel_id);

-- Speed up contribution history reads per group by date.
CREATE INDEX IF NOT EXISTS contributions_stokvel_paid_at_idx
ON public.contributions (stokvel_id, paid_at DESC);
