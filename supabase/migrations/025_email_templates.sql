-- 025_email_templates.sql
-- Admin-editable overrides for customer emails (/admin/email-templates).
-- api/admin/email-templates.js reads/writes via the service-role key and the
-- senders (api/_lib/billing-emails.js, api/_welcome-email.js) prefer an enabled
-- row over the hardcoded default. The admin UI degrades to code defaults until
-- this table exists. PHI-free bodies only. Idempotent.

create table if not exists public.email_templates (
  key         text primary key,
  subject     text not null,
  body_html   text not null,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- Server reads/writes via the service-role key (RLS bypassed); deny anon/auth.
alter table public.email_templates enable row level security;
grant select, insert, update, delete on public.email_templates to service_role;

comment on table public.email_templates is
  'Admin-editable overrides for customer emails. Keys: welcome, booking_confirmed, payment_receipt, plan_renewed, payment_failed. PHI-free bodies only.';
