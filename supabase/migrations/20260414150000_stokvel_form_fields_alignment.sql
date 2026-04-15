-- Align stored stokvel fields with create/request forms.
ALTER TABLE public.stokvels
ADD COLUMN IF NOT EXISTS members_count integer;

ALTER TABLE public.stokvels
ADD COLUMN IF NOT EXISTS member_details jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.stokvels
ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
