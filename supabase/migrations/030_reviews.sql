-- 030_reviews.sql
-- Post-visit NPS + free-text review capture. Cron seeds rows with a tokenized
-- link; public /review submits stamp score/text; admin /admin/reviews moderates
-- public eligibility. PHI-free (customer-authored sentiment only). Idempotent.

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.tenants(id) on delete cascade,
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  profile_id      uuid references auth.users(id) on delete set null,
  email           text,
  token           text not null,
  nps_score       integer check (nps_score is null or (nps_score between 0 and 10)),
  text            text,
  allow_public    boolean not null default false,
  submitted_at    timestamptz,
  approved        boolean not null default false,
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);

create unique index if not exists reviews_appointment_id_key on public.reviews (appointment_id);
create unique index if not exists reviews_token_key on public.reviews (token);
create index if not exists reviews_tenant_submitted_idx
  on public.reviews (tenant_id, submitted_at desc);

alter table public.reviews enable row level security;
grant select, insert, update, delete on public.reviews to service_role;

comment on table public.reviews is
  'Post-visit NPS + review capture. Cron seeds rows with a tokenized link; public submit stamps score/text; admin moderation gates public eligibility. PHI-free.';
