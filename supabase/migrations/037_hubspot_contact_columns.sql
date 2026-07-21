-- 037_hubspot_contact_columns.sql
-- HubSpot CRM sync: link columns and staff-editable hospitality guest profile.
--
-- HubSpot is un-BAA'd (per docs/PHI_DATA_FLOW.md), so the outbound payload from
-- `api/_hubspot.js` is architecturally restricted to identifiers + lifecycle
-- facets + hospitality preferences. This migration adds:
--   * profiles.hubspot_contact_id / hubspot_synced_at   — set by signup + consent triggers
--   * appointments.hubspot_contact_id / hubspot_synced_at — set by booking triggers
--   * profiles.guest_profile jsonb                       — non-PHI hospitality dossier
--
-- guest_profile shape (staff-only writes via /api/admin/guest-profile):
--   {
--     instagram, tiktok, linkedin,   -- social handles / URLs
--     style, wardrobe,               -- short free-text style + wardrobe notes
--     beverage, music,               -- favorite drink / playlist
--     notes, context,                -- "anything to help" + occupation/referrer
--     updatedBy, updatedAt           -- audit trail (profile_id of the staff editor)
--   }
--
-- IMPORTANT: guest_profile is NOT PHI. Do NOT store allergies, medications,
-- diagnoses, conditions, or any health information here. The HubSpot outbound
-- allowlist + CI PHI-guard (scripts/no-phi-in-hubspot-qa.mjs) enforce this on
-- the wire, but the doctrine starts at the schema.

alter table public.profiles
  add column if not exists hubspot_contact_id text,
  add column if not exists hubspot_synced_at  timestamptz,
  add column if not exists guest_profile      jsonb not null default '{}'::jsonb;

alter table public.appointments
  add column if not exists hubspot_contact_id text,
  add column if not exists hubspot_synced_at  timestamptz;

create index if not exists idx_profiles_hubspot_contact
  on public.profiles (hubspot_contact_id);

create index if not exists idx_appointments_hubspot_contact
  on public.appointments (hubspot_contact_id);

comment on column public.profiles.hubspot_contact_id is
  'HubSpot Contact id. Populated by /api/auth/welcome-email (signup) and /api/admin/guest-profile.';

comment on column public.profiles.guest_profile is
  'Non-PHI hospitality dossier (social handles, preferences, style, notes). Staff-editable via /admin/crm. NEVER store PHI here — see docs/PHI_DATA_FLOW.md.';

comment on column public.appointments.hubspot_contact_id is
  'HubSpot Contact id set at booking lifecycle sync (Stripe webhook / Acuity webhook / manual booking).';
