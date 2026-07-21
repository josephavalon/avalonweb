-- Event organizers receive access only after an Avalon admin approves and
-- assigns an event. The existing hashed-token invitation flow is reused, with
-- an explicit event binding so acceptance cannot create an unscoped promoter.

alter table public.invitations
  add column if not exists event_container_id uuid references public.event_containers(id) on delete cascade;

alter table public.invitations drop constraint if exists invitations_invited_role_check;
alter table public.invitations add constraint invitations_invited_role_check
  check (invited_role in (
    'client','nurse','rn','np','physician','medical_director','ops_manager','staff','promoter','admin','founder'
  ));

create index if not exists invitations_event_container_idx
  on public.invitations (event_container_id)
  where event_container_id is not null;
