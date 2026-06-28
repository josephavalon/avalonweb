-- 022_profile_deletion_request.sql
-- Self-serve account deletion is a REQUEST, never a hard delete (medical-record
-- retention / HIPAA). api/me/account/delete-request.js stamps these columns and
-- writes an audit event; staff action the request. Safe to run repeatedly.

alter table public.profiles add column if not exists deletion_requested_at  timestamptz;
alter table public.profiles add column if not exists deletion_request_reason text;
