-- Support storing intended role for invitation-driven joins.
ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS group_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invitations_group_role_check'
  ) THEN
    ALTER TABLE public.invitations
    ADD CONSTRAINT invitations_group_role_check
    CHECK (group_role IS NULL OR group_role IN ('member', 'admin', 'treasurer'));
  END IF;
END
$$;

-- Ensure every existing stokvel has at least one treasurer.
WITH stokvel_without_treasurer AS (
  SELECT s.id AS stokvel_id
  FROM public.stokvels s
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.stokvel_members smt
    WHERE smt.stokvel_id = s.id
      AND smt.group_role = 'treasurer'
  )
),
picked_member AS (
  SELECT DISTINCT ON (sm.stokvel_id)
    sm.stokvel_id,
    sm.user_id
  FROM public.stokvel_members sm
  JOIN stokvel_without_treasurer swt ON swt.stokvel_id = sm.stokvel_id
  ORDER BY sm.stokvel_id, sm.created_at NULLS LAST, sm.user_id
)
UPDATE public.stokvel_members sm
SET group_role = 'treasurer'
FROM picked_member p
WHERE sm.stokvel_id = p.stokvel_id
  AND sm.user_id = p.user_id
  AND sm.group_role <> 'treasurer';
