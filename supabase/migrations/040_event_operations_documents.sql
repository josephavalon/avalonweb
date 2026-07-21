-- Non-clinical event operations documents: COIs, floor plans, and venue terms.
-- These records must never contain attendee or patient information.

create table if not exists public.event_documents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references public.tenants(id) on delete cascade,
  container_id uuid not null references public.event_containers(id) on delete cascade,
  kind         text not null check (kind in ('coi', 'floor_plan', 'venue_photo', 'venue_requirements', 'other')),
  file_name    text not null,
  content_type text not null,
  size_bytes   integer not null default 0,
  storage_path text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  uploaded_by  uuid references auth.users(id) on delete set null,
  reviewed_by  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz,
  expires_at   date,
  created_at   timestamptz not null default now()
);

create index if not exists event_documents_container_idx
  on public.event_documents (container_id, kind, status, created_at desc);

alter table public.event_documents enable row level security;
grant select, insert, update, delete on public.event_documents to service_role;

drop policy if exists "event documents staff or promoter read" on public.event_documents;
create policy "event documents staff or promoter read"
  on public.event_documents for select
  using (
    (app_private.same_tenant(tenant_id) and app_private.is_staff())
    or app_private.is_event_promoter(container_id)
  );

insert into storage.buckets (id, name, public)
values ('event-documents', 'event-documents', false)
on conflict (id) do nothing;
