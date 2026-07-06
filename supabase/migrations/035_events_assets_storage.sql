-- 035_events_assets_storage.sql
-- Storage for organizer event imagery (ET7, amendment J + eng review T8).
--
-- Bucket is PRIVATE: originals are never publicly reachable. The API
-- generates renditions (EXIF-stripped webp at fixed sizes) and serves them
-- via signed URLs; `event_assets.renditions` stores the rendition paths.
-- Uploads happen through short-lived signed upload URLs minted by
-- /api/events/assets (service role) — the anon key can neither read nor
-- write this bucket directly.
--
-- Seed Avalon-authored theme rows (curated picker): themes recolor
-- LIVE-STATE accents only; chrome, mono voice, and clinical red/green are
-- locked in code (src/lib/eventStatus.js) and cannot be themed over.
-- Idempotent.

insert into storage.buckets (id, name, public)
values ('event-assets', 'event-assets', false)
on conflict (id) do nothing;

-- No storage RLS policies for anon/authenticated: all access flows through
-- the service role in /api/events/assets (deny-by-default posture).

insert into public.event_themes (name, tokens, active)
select v.name, v.tokens::jsonb, true
from (values
  ('Avalon Drip',  '{"live": "#C8F135"}'),
  ('Golden Hour',  '{"live": "#F5B85A"}'),
  ('Plasma',       '{"live": "#F5B8C4"}'),
  ('Ice',          '{"live": "#7DD3FC"}')
) as v(name, tokens)
where not exists (select 1 from public.event_themes t where t.name = v.name);
