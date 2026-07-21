-- 027_refund_requests_resolution.sql
-- Staff back-office columns for /admin/refunds. The endpoint degrades to a
-- status-only update if these are missing, but applying this turns on
-- resolver/refund-id/note display in the UI. Idempotent.

alter table public.refund_requests add column if not exists resolved_at         timestamptz;
alter table public.refund_requests add column if not exists resolver_id         uuid references public.profiles(id);
alter table public.refund_requests add column if not exists refund_id           text;
alter table public.refund_requests add column if not exists refund_amount_cents integer;
alter table public.refund_requests add column if not exists note                text;

create index if not exists refund_requests_status_created_idx
  on public.refund_requests (status, created_at desc);
