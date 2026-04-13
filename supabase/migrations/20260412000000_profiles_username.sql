-- Unique username on profiles (lowercase a-z, 0-9, underscore, length 3–30).
-- Run in Supabase SQL Editor or via supabase db push.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Deterministic placeholder for existing users (they can change it in the app).
UPDATE public.profiles p
SET username = 'u_' || substring(replace(p.id::text, '-', ''), 1, 20)
WHERE p.username IS NULL OR trim(p.username) = '';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (username)
  WHERE username IS NOT NULL AND length(trim(username)) > 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_check
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$');
