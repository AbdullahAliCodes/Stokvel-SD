-- =============================================================================
-- Stokvel Management System — development seed data (SQL-only)
-- =============================================================================
-- Prerequisites:
--   1. Run supabase/schema.sql on a fresh Supabase project.
--   2. Create Auth users (Authentication → Users → Add user) with these emails:
--        - treasurer@example.com
--        - member1@example.com
--        - member2@example.com
--      Set passwords in the dashboard (e.g. DevPassword123! for local dev only).
--   3. Run this script in the SQL Editor.
--
-- Safe to re-run: removes the demo stokvel (fixed UUID) and re-inserts related rows.
-- Do NOT run against production.
-- =============================================================================

-- Demo stokvel id (fixed for idempotent reset)
-- f9e8d7c6-0000-0000-0000-000000000001

DELETE FROM public.stokvels
WHERE id = 'f9e8d7c6-0000-0000-0000-000000000001'::uuid;

DO $$
DECLARE
  v_stokvel   uuid := 'f9e8d7c6-0000-0000-0000-000000000001';
  v_treasurer uuid;
  v_member1   uuid;
  v_member2   uuid;
  v_month     text := '2026-06';
BEGIN
  SELECT id INTO v_treasurer FROM auth.users WHERE lower(email) = 'treasurer@example.com' LIMIT 1;
  SELECT id INTO v_member1   FROM auth.users WHERE lower(email) = 'member1@example.com' LIMIT 1;
  SELECT id INTO v_member2   FROM auth.users WHERE lower(email) = 'member2@example.com' LIMIT 1;

  IF v_treasurer IS NULL OR v_member1 IS NULL OR v_member2 IS NULL THEN
    RAISE EXCEPTION
      'Missing Auth users. Create treasurer@example.com, member1@example.com, and member2@example.com in Authentication → Users, then re-run this script.';
  END IF;

  -- Profiles (linked to auth.users)
  INSERT INTO public.profiles (id, first_name, last_name, email, phone_number, username, role)
  VALUES
    (v_treasurer, 'Sipho', 'Nkosi', 'treasurer@example.com', '0812345678', 'sipho_nkosi', 'user'),
    (v_member1,   'Thabo', 'Mbeki', 'member1@example.com', '0823456789', 'thabo_mbeki', 'user'),
    (v_member2,   'Lerato', 'Moloi', 'member2@example.com', '0834567890', 'lerato_moloi', 'user')
  ON CONFLICT (id) DO UPDATE SET
    first_name   = EXCLUDED.first_name,
    last_name    = EXCLUDED.last_name,
    email        = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    username     = EXCLUDED.username,
    updated_at   = timezone('utc'::text, now());

  -- Active rotating stokvel (3 members, R1000/month)
  INSERT INTO public.stokvels (
    id,
    name,
    status,
    contribution_amount,
    type,
    cycle_length,
    members_count,
    meeting_frequency,
    payout_order,
    payout_order_type,
    payout_sequence,
    is_public
  ) VALUES (
    v_stokvel,
    'Kasi Wealth Builders',
    'active',
    1000,
    'Rotating',
    3,
    3,
    'monthly',
    'randomize',
    'randomize',
    jsonb_build_array(v_treasurer::text, v_member1::text, v_member2::text),
    false
  );

  INSERT INTO public.stokvel_members (stokvel_id, user_id, group_role) VALUES
    (v_stokvel, v_treasurer, 'treasurer'),
    (v_stokvel, v_member1,   'member'),
    (v_stokvel, v_member2,   'member');

  -- Market rates (for dashboard widgets)
  INSERT INTO public.market_data (rate_type, value, last_updated)
  SELECT 'repo', 8.25, timezone('utc'::text, now())
  WHERE NOT EXISTS (SELECT 1 FROM public.market_data WHERE rate_type = 'repo');

  INSERT INTO public.market_data (rate_type, value, last_updated)
  SELECT 'prime', 11.75, timezone('utc'::text, now())
  WHERE NOT EXISTS (SELECT 1 FROM public.market_data WHERE rate_type = 'prime');

  -- Upcoming meeting
  INSERT INTO public.meetings (
    stokvel_id,
    title,
    meeting_date,
    agenda,
    notes,
    meeting_link,
    created_by
  ) VALUES (
    v_stokvel,
    'June check-in',
    timezone('utc'::text, timestamptz '2026-06-15 18:00:00+00'),
    'Review contributions and confirm payout recipient.',
    'Review contributions and confirm payout recipient.',
    'https://meet.example.com/kasi-wealth-june',
    v_treasurer
  );

  -- Contributions (target_month = YYYY-MM)
  INSERT INTO public.contributions (
    stokvel_id,
    user_id,
    amount,
    paid_at,
    target_month,
    treasurer_approval_status,
    treasurer_approved_at,
    treasurer_approved_by
  ) VALUES (
    v_stokvel,
    v_treasurer,
    1000,
    timezone('utc'::text, now()),
    v_month,
    'approved',
    timezone('utc'::text, now()),
    v_treasurer
  );

  INSERT INTO public.contributions (
    stokvel_id,
    user_id,
    amount,
    paid_at,
    target_month,
    treasurer_approval_status
  ) VALUES (
    v_stokvel,
    v_member1,
    1000,
    timezone('utc'::text, now()),
    v_month,
    'pending'
  );

  -- Member2: flagged missed payment (treasurer flagged, not yet paid)
  INSERT INTO public.missed_payments (stokvel_id, user_id, target_month, flagged_by)
  VALUES (v_stokvel, v_member2, v_month, v_treasurer);

  -- Payout schedule for the cycle
  INSERT INTO public.payouts (
    stokvel_id,
    user_id,
    target_month,
    scheduled_payout_date,
    cycle_index,
    status
  ) VALUES (
    v_stokvel,
    v_member1,
    v_month,
    '2026-06-30'::date,
    0,
    'pending'
  );

  -- Pending invitation (not yet a member)
  INSERT INTO public.invitations (stokvel_id, email, status, invited_by, group_role)
  VALUES (
    v_stokvel,
    'prospect@example.com',
    'pending',
    v_treasurer,
    'member'
  );

  -- Sample support issue
  INSERT INTO public.issues (stokvel_id, user_id, issue_type, description, status)
  VALUES (
    v_stokvel,
    v_member1,
    'payment',
    'Seed data: example open issue for admin/treasurer review.',
    'open'
  );

  RAISE NOTICE 'Seed complete. Stokvel id: %', v_stokvel;
  RAISE NOTICE 'Log in as treasurer@example.com, member1@example.com, or member2@example.com (passwords set in Auth dashboard).';
END $$;
