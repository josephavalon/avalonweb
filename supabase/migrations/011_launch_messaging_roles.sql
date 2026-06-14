-- Align messaging RLS with the launch role model: ADMIN / CLIENT / NURSE.
-- Clients can start support conversations with active admins/nurses; nurses
-- and admins can start operational conversations with clients or each other.

drop policy if exists "clients can read launch messaging support directory" on public.profiles;
create policy "clients can read launch messaging support directory"
  on public.profiles for select
  using (
    app_private.profile_role() = 'client'
    and status = 'active'
    and role in ('admin', 'nurse')
  );

drop policy if exists "admins can create conversations" on public.conversations;
drop policy if exists "launch users can create conversations" on public.conversations;
create policy "launch users can create conversations"
  on public.conversations for insert
  with check (
    app_private.profile_role() in ('admin', 'client', 'nurse')
  );

drop policy if exists "admins can insert participants" on public.conversation_participants;
drop policy if exists "launch users can insert conversation participants" on public.conversation_participants;
create policy "launch users can insert conversation participants"
  on public.conversation_participants for insert
  with check (
    user_id = auth.uid()
    or app_private.profile_role() in ('admin', 'nurse')
    or (
      app_private.profile_role() = 'client'
      and role in ('admin', 'nurse')
      and exists (
        select 1
        from public.profiles p
        where p.id = user_id
          and p.status = 'active'
          and p.role in ('admin', 'nurse')
      )
    )
  );
