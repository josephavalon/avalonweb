-- 019_profile_unified.sql
-- Patient portal v1 (wave 1): unify the editable client profile on `profiles`.
--
-- The Account page (app-modules/pages/members/Account.jsx) used to persist edits
-- to localStorage only. To give returning clients a real server-side identity +
-- PHI record (and so the RN/admin team can see what the member edited), we add
-- the columns the page actually writes: name parts, address, DOB, emergency
-- contact, an inline PHI blob (allergies / medications / conditions / screening
-- answers), comm preferences, and the Stripe customer id we'll reuse from
-- checkout. All nullable so the existing rows keep validating.
--
-- The pre-existing gfe / saved_address columns from 018 are kept untouched.

alter table public.profiles add column if not exists full_name          text;
alter table public.profiles add column if not exists preferred_name     text;
alter table public.profiles add column if not exists address            text;
alter table public.profiles add column if not exists date_of_birth      date;

-- emergency_contact shape: { name, relationship, phone }
alter table public.profiles add column if not exists emergency_contact  jsonb;

-- phi shape: { allergies, medications, conditions, covidRecent,
--              infectiousIllness, ivHistory, nurseNotes,
--              lastReviewedAt, lastReviewedBy }
alter table public.profiles add column if not exists phi                jsonb;

-- comm_prefs shape: { channel, hipaaMention, smsReminders, emailSummaries,
--                     marketing, quietHours }
alter table public.profiles add column if not exists comm_prefs         jsonb;

-- Mirror of Stripe customer id once a member has paid for a visit or plan.
-- Unique because a Stripe customer maps to exactly one Avalon profile.
alter table public.profiles add column if not exists stripe_customer_id text;
create unique index if not exists profiles_stripe_customer_id_uidx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- RLS: 003 already grants self-SELECT and operator-manage on profiles. The
-- self-SELECT is via "profiles self or admin read" (id = auth.uid() OR staff in
-- same tenant), and "admins manage profiles" gives operators full write. We
-- additionally need a self-UPDATE policy so a signed-in member can PATCH their
-- own row from /api/me/profile (the API uses the service-role client, so this
-- policy is defence-in-depth — it also lets future client-direct edits work
-- without elevating to service role).
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
