-- Invite brute-force lockout.
--
-- A 6-digit invite SMS code over a 14-day TTL has ~1M brute-force space; with
-- only an IP-keyed rate limit, a residential-proxy attacker could expect to
-- crack a known invitee's code in single-digit hours. This migration adds a
-- per-invitation failure counter + lock window so the validate endpoint can
-- auto-revoke an invite after a small number of bad attempts.
--
-- Columns are additive with safe defaults — existing rows keep working
-- without a backfill, and old API code that doesn't read these columns
-- continues to function.

alter table public.invitations
  add column if not exists failed_attempts integer not null default 0;
alter table public.invitations
  add column if not exists locked_at timestamptz;

comment on column public.invitations.failed_attempts is
  'Per-invite counter of bad-code attempts. Auto-revoked at 10 (see api/invite/validate.js).';
comment on column public.invitations.locked_at is
  'Set when failed_attempts crosses the lockout threshold. Validate refuses lookups while non-null.';

create index if not exists invitations_locked_at_idx on public.invitations (locked_at) where locked_at is not null;
