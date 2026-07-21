-- 018_gfe_profile_sync.sql
-- GFE auto-assign (Qualiphy) + Acuity-as-source-of-record → profile cache for
-- fast checkout. Acuity holds the GFE on the appointment; both paths (Qualiphy
-- auto, Avalon NP manual) write the same Acuity field, and the Acuity webhook
-- syncs it down to the patient profile here.

-- Profile cache that powers fast checkout: a cleared GFE + a saved address mean
-- a returning client skips the GFE step and gets their address prefilled.
alter table public.profiles add column if not exists gfe jsonb not null default '{}'::jsonb;
-- gfe shape: { status, clearedAt, expiresAt, provider, pdfUrl, examId, source }
alter table public.profiles add column if not exists saved_address jsonb;
-- saved_address shape: { line1, city, state, zip, raw }

-- Per-tenant GFE policy: which booking categories require a GFE, and which
-- Qualiphy exam id to assign. Toggle ON → Qualiphy auto-conducts; toggle OFF →
-- Avalon NP does it in Acuity (no app involvement).
create table if not exists public.gfe_settings (
  tenant_id          uuid primary key references public.tenants(id) on delete cascade,
  require_mobile     boolean not null default false,
  require_plan       boolean not null default false,
  require_events     boolean not null default false,
  qualiphy_exam_ids  jsonb   not null default '[4106]'::jsonb,  -- IV/IM Nutrient Therapy GFE
  qualiphy_clinic_id integer,                                    -- 4389
  updated_at         timestamptz not null default now()
);

alter table public.gfe_settings enable row level security;
-- service-role only (admin endpoints read/write it server-side).

grant select, insert, update, delete on public.gfe_settings to service_role;

-- Index profiles by email for the Acuity→profile sync match (lower(email)).
create index if not exists profiles_email_lower_idx on public.profiles (lower(email));
