ALTER TABLE public.stokvels
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

UPDATE public.stokvels
SET is_public = false;
