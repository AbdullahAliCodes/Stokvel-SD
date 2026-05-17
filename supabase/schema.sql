-- =============================================================================
-- Stokvel Management System — public schema (matches production Supabase DB)
-- =============================================================================
-- Run in the Supabase SQL Editor on a **new** project.
-- Requires Supabase Auth (profiles.id references auth.users).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone_number text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  role text NOT NULL DEFAULT 'user'::text,
  username text,
  email text
);

CREATE TABLE public.stokvels (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  status text NOT NULL DEFAULT 'pending'::text,
  contribution_amount numeric DEFAULT 0,
  payout_order text DEFAULT 'randomize'::text,
  meeting_frequency text DEFAULT 'monthly'::text,
  type text DEFAULT 'Rotating'::text,
  cycle_length integer DEFAULT 12,
  members_count integer,
  member_details jsonb DEFAULT '[]'::jsonb,
  documents jsonb DEFAULT '[]'::jsonb,
  is_public boolean DEFAULT false,
  payout_order_type text DEFAULT 'randomize'::text,
  payout_sequence jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public.stokvel_members (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id uuid NOT NULL REFERENCES public.stokvels (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  group_role text NOT NULL DEFAULT 'member'::text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.contributions (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id uuid NOT NULL REFERENCES public.stokvels (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  target_month text,
  paystack_reference text,
  treasurer_approval_status text NOT NULL DEFAULT 'pending'::text,
  treasurer_approved_at timestamptz,
  treasurer_approved_by uuid
);

CREATE TABLE public.invitations (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  stokvel_id uuid REFERENCES public.stokvels (id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid DEFAULT uuid_generate_v4(),
  status text DEFAULT 'pending'::text,
  created_at timestamptz DEFAULT now(),
  invited_by uuid REFERENCES auth.users (id),
  group_role text
);

CREATE TABLE public.issues (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users (id),
  stokvel_id uuid REFERENCES public.stokvels (id) ON DELETE CASCADE,
  issue_type text,
  description text,
  status text DEFAULT 'open'::text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.market_data (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_type text NOT NULL,
  value numeric NOT NULL,
  last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meetings (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id uuid NOT NULL REFERENCES public.stokvels (id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_date timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  meeting_link text,
  agenda text,
  minutes text,
  created_by uuid REFERENCES public.profiles (id),
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.member_health_scores (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.stokvels (id) ON DELETE CASCADE,
  score numeric NOT NULL,
  grade text NOT NULL,
  on_time_rate numeric,
  missed_payments integer,
  avg_days_late numeric,
  streak_months integer,
  engagement_score numeric,
  last_calculated_at timestamptz DEFAULT timezone('utc'::text, now()),
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  confidence numeric,
  model_version text DEFAULT 'v1'::text
);

CREATE TABLE public.missed_payments (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id uuid NOT NULL REFERENCES public.stokvels (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_month text NOT NULL,
  flagged_by uuid NOT NULL REFERENCES auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.payouts (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  stokvel_id uuid NOT NULL REFERENCES public.stokvels (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  target_month text NOT NULL,
  scheduled_payout_date date NOT NULL,
  cycle_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text,
  disbursed_at timestamptz,
  disbursed_by uuid
);

-- -----------------------------------------------------------------------------
-- Row Level Security (from pg_policies)
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stokvel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
  ON public.profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  TO public
  USING (auth.uid() = id);

CREATE POLICY "Stokvels are viewable by everyone."
  ON public.stokvels FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert stokvels."
  ON public.stokvels FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can update stokvels"
  ON public.stokvels FOR UPDATE
  TO public
  USING (
    (SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'admin'::text
  );

CREATE POLICY "Memberships are viewable."
  ON public.stokvel_members FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert stokvel memberships."
  ON public.stokvel_members FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Contributions are viewable by everyone"
  ON public.contributions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert contributions"
  ON public.contributions FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Meetings are viewable by everyone"
  ON public.meetings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert meetings"
  ON public.meetings FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY market_data_select_public
  ON public.market_data FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY members_read_own_score
  ON public.member_health_scores FOR SELECT
  TO public
  USING (auth.uid() = user_id);

CREATE POLICY service_role_upsert_scores
  ON public.member_health_scores
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text);
