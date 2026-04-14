ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS meeting_link text;

ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS agenda text;

ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS minutes text;

ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS meetings_stokvel_date_idx
ON public.meetings (stokvel_id, meeting_date);
