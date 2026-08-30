-- Immediate containment for member message attachments.
--
-- Migration 026 created this bucket as public and allowed browser-direct
-- uploads. Member messages can contain health and care information, so a public
-- object URL is not an acceptable access boundary. Keep the feature disabled
-- until a server-authorized path provides quarantine, content validation,
-- malware/DLP scanning, short-lived download authorization, audit, and
-- lifecycle deletion.

update storage.buckets
set public = false
where id = 'member-messages';

drop policy if exists "members upload own message images" on storage.objects;
drop policy if exists "members read own message images" on storage.objects;
drop policy if exists "members delete own message images" on storage.objects;

comment on column public.messages.attachments is
  'Legacy attachment metadata only. Direct member upload/read is disabled until the private scanned attachment service is released.';
