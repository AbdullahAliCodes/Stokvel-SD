-- Add contact email to profiles so app-level notifications can be sent.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- Backfill missing profile emails for existing rows as requested.
UPDATE public.profiles
SET email = 'imaansaloojee123@gmail.com'
WHERE email IS NULL OR btrim(email) = '';

-- Keep common query path fast.
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (lower(email));

-- Invitation workflow enhancements.
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id uuid REFERENCES public.stokvels(id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid DEFAULT uuid_generate_v4(),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.invitations
ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invitations_status_check'
  ) THEN
    ALTER TABLE public.invitations
    ADD CONSTRAINT invitations_status_check
    CHECK (status IN ('pending', 'accepted', 'processed', 'pending_group_request'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations (token);
CREATE INDEX IF NOT EXISTS invitations_stokvel_status_idx ON public.invitations (stokvel_id, status);
