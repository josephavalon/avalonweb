-- Avalon approval controls for organizer-run event commerce.
-- A locked price remains visible to the organizer but cannot be changed by
-- the organizer API. Clinical tiers are already protected by service_id and
-- experience_only invariants; this adds the explicit commercial sign-off.

alter table public.event_tiers
  add column if not exists price_locked boolean not null default false;

create index if not exists event_tiers_admin_review_idx
  on public.event_tiers (container_id, experience_only, price_locked, active);
