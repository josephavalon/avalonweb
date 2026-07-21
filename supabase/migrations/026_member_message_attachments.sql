-- 026_member_message_attachments.sql
-- Image attachments on member <-> care-team messages (Messages.jsx). The client
-- reads/inserts with a missing-column fallback, so plain text messaging keeps
-- working until this is applied; this enables image bubbles to persist.
-- Idempotent.

alter table public.messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Storage bucket for member-uploaded message images. Public so the stored
-- public URL renders without signing (the member client uses getPublicUrl).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-messages', 'member-messages', true, 10485760,
  array['image/png','image/jpeg','image/gif','image/webp','image/heic','image/heif']
)
on conflict (id) do nothing;

-- Member-scoped storage RLS: a member may write/read/delete ONLY under a folder
-- named after their own auth uid (first path segment). Public bucket => anyone
-- can read via URL, but writes are confined to the owner's prefix.
create policy "members upload own message images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'member-messages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members read own message images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'member-messages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "members delete own message images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'member-messages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
