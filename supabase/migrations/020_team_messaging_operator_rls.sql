-- 020_team_messaging_operator_rls.sql
-- Internal staff inbox (admin <-> admin, staff <-> staff).
--
-- The launch messaging RLS (011_launch_messaging_roles.sql) only let
-- admin / client / nurse create conversations and add participants. A `staff`
-- operator therefore could not start an internal thread — the new "My inbox"
-- surface needs them to. Widen the two INSERT policies to all operator roles
-- via app_private.is_operator() (= ops_manager | staff | admin | founder, from
-- 012_admin_team_management.sql), keeping every existing client/nurse launch
-- path intact. SELECT / message-insert / last_read policies (002, 011) are
-- already participant-scoped and need no change.

drop policy if exists "launch users can create conversations" on public.conversations;
create policy "launch users can create conversations"
  on public.conversations for insert
  with check (
    app_private.profile_role() in ('admin', 'client', 'nurse')
    or app_private.is_operator()
  );

drop policy if exists "launch users can insert conversation participants" on public.conversation_participants;
create policy "launch users can insert conversation participants"
  on public.conversation_participants for insert
  with check (
    -- Always allowed to add yourself.
    user_id = auth.uid()
    -- Operators (incl. staff) can add any teammate to a conversation.
    or app_private.is_operator()
    -- Legacy launch paths.
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
