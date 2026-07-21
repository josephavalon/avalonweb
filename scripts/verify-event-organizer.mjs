import assert from 'node:assert/strict';
import fs from 'node:fs';
import { allowedPortalsForUser, resolvePortalSession } from '../src/lib/portalAccess.js';
import { isValidTier } from '../api/_lib/invite-token.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const organizerApi = fs.readFileSync(new URL('../api/events/organizer.js', import.meta.url), 'utf8');
const organizerInvite = fs.readFileSync(new URL('../api/admin/events/organizer-invite.js', import.meta.url), 'utf8');
const organizerPage = fs.readFileSync(new URL('../app-modules/pages/organizer/EventHub.jsx', import.meta.url), 'utf8');
const appRoutes = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/038_event_organizer_invites.sql', import.meta.url), 'utf8');
const assetApi = fs.readFileSync(new URL('../api/events/assets.js', import.meta.url), 'utf8');
const adminEventApi = fs.readFileSync(new URL('../api/admin/events/management.js', import.meta.url), 'utf8');
const adminEventPage = fs.readFileSync(new URL('../app-modules/pages/admin/EventsBackend.jsx', import.meta.url), 'utf8');
const publicEventPage = fs.readFileSync(new URL('../app-modules/source/pages/EventPage.jsx', import.meta.url), 'utf8');
const adminControlsMigration = fs.readFileSync(new URL('../supabase/migrations/039_event_admin_controls.sql', import.meta.url), 'utf8');
const eventDocumentsApi = fs.readFileSync(new URL('../api/events/documents.js', import.meta.url), 'utf8');
const eventDocumentsMigration = fs.readFileSync(new URL('../supabase/migrations/040_event_operations_documents.sql', import.meta.url), 'utf8');
const loginPage = fs.readFileSync(new URL('../app-modules/pages/Login.jsx', import.meta.url), 'utf8');
const eventsPage = fs.readFileSync(new URL('../app-modules/pages/Events.jsx', import.meta.url), 'utf8');
const viteConfig = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');

check('promoter receives only organizer portal access', () => {
  assert.deepEqual(allowedPortalsForUser({ canonicalRole: 'promoter' }), ['organizer']);
});

check('promoter resolves to the dedicated Event Hub', () => {
  const session = resolvePortalSession({ canonicalRole: 'promoter', requestedPortal: 'organizer' });
  assert.equal(session.role, 'promoter');
  assert.equal(session.redirect, '/organizer');
});

check('organizer login submits visible browser-autofilled credentials', () => {
  assert.match(loginPage, /name=\{name \|\| id\}/);
  assert.match(loginPage, /form\.elements\.namedItem\('login-identifier'\)/);
  assert.match(loginPage, /identifierInput\?\.value/);
  assert.match(loginPage, /passwordInput\?\.value/);
});

check('organizer routes preserve the dedicated Event Hub login entry point', () => {
  assert.match(appRoutes, /pathname\.startsWith\('\/organizer'\)/);
  assert.match(appRoutes, /portal=organizer&redirect=/);
  assert.match(loginPage, /next === 'organizer' && !supabaseMode && demoAuthAvailable/);
});

check('event discovery orders upcoming above past with the requested events', () => {
  assert.ok(eventsPage.indexOf('Upcoming Events') < eventsPage.indexOf('Past Events'));
  assert.match(eventsPage, /Cannabis CE Night/);
  assert.match(eventsPage, /2026-08-28/);
  assert.match(eventsPage, /Maxim Superbowl Party/);
  assert.match(eventsPage, /2026-02-07/);
});

check('local Event Hub preview does not pin HMR to another port', () => {
  assert.doesNotMatch(viteConfig, /hmr:\s*\{[\s\S]*?port:\s*5173/);
});

check('an existing account can reuse its password through a scoped organizer entitlement', () => {
  const session = resolvePortalSession({
    canonicalRole: 'client',
    authUser: { app_metadata: { portal_access: ['organizer'] } },
    requestedPortal: 'organizer',
  });
  assert.equal(session.role, 'promoter');
  assert.equal(session.redirect, '/organizer');
});

check('organizer is a valid invitation tier', () => assert.equal(isValidTier('promoter'), true));

check('organizer route is role-gated', () => {
  assert.match(appRoutes, /path="\/organizer"[\s\S]*allowedRoles=\{\['promoter', 'admin'\]\}/);
});

check('organizer invitation is bound to an approved event', () => {
  assert.match(organizerInvite, /APPROVED_STATUSES/);
  assert.match(organizerInvite, /event_container_id: event\.id/);
  assert.match(migration, /event_container_id uuid references public\.event_containers/);
  assert.match(organizerInvite, /reusedCredentials: true/);
  assert.match(organizerInvite, /preservedRole: profile\.role/);
});

check('organizer-created ticket tiers are experience-only and non-clinical', () => {
  assert.match(organizerApi, /experience_only: true/);
  assert.match(organizerApi, /service_id: null/);
  assert.match(organizerApi, /Clinical service pricing is managed by Avalon/);
});

check('organizer payload does not select attendee identity or clinical status', () => {
  assert.doesNotMatch(organizerApi, /select\([^\n]*(attendee_name|attendee_email|gfe_status|medical|condition)/i);
  assert.match(organizerApi, /privacyMode: 'aggregate-only'/);
  assert.match(organizerApi, /experienceOrderIds/);
  assert.match(organizerApi, /tier\.experience_only && !tier\.service_id/);
});

check('Event Hub states the commercial and clinical boundary', () => {
  assert.match(organizerPage, /Your lane: event commerce/);
  assert.match(organizerPage, /never attendee identity, health information, clinical status, or clinical-service revenue/);
});

check('asset upload authorizes the canonical promoter role', () => {
  assert.match(assetApi, /auth\.role \|\| auth\.profile\?\.role/);
  assert.match(assetApi, /from\('event_promoters'\)/);
  assert.match(assetApi, /eq\('profile_id', auth\.user\.id\)/);
});

check('Avalon admin owns event approval and clinical configuration', () => {
  assert.match(adminEventApi, /requireAdmin/);
  assert.match(adminEventApi, /action === 'set_status'/);
  assert.match(adminEventApi, /clinical \? service\.id : null/);
  assert.match(adminEventPage, /Avalon-only/);
  assert.match(adminEventPage, /Issue Event Hub login/);
});

check('Avalon can lock experience pricing against organizer edits', () => {
  assert.match(adminControlsMigration, /price_locked boolean not null default false/);
  assert.match(organizerApi, /This admission price is locked by Avalon/);
  assert.match(organizerPage, /Avalon locked/);
});

check('public event checkout defaults to admission tiers', () => {
  assert.match(publicEventPage, /item\.experienceOnly === true/);
  assert.match(publicEventPage, /\?tier=/);
  assert.match(publicEventPage, /Presented by/);
});

check('Event Hub captures the complete venue and production handoff', () => {
  assert.match(organizerPage, /Venue & logistics/);
  assert.match(organizerPage, /What Avalon needs to thrive/);
  assert.match(organizerPage, /Extension cords & power strips/);
  assert.match(organizerPage, /Upload COI/);
  assert.match(organizerPage, /Venue photos/);
  assert.match(organizerApi, /organizer_logistics/);
  assert.match(organizerApi, /coiRequested/);
});

check('COI, floor plan, and venue photos use a private operations-document lane', () => {
  assert.match(eventDocumentsMigration, /event-documents', 'event-documents', false/);
  assert.match(eventDocumentsMigration, /venue_photo/);
  assert.match(eventDocumentsApi, /never attendee data, charts, health forms, or clinical records/);
  assert.match(eventDocumentsApi, /MAX_BYTES = 20 \* 1024 \* 1024/);
  assert.match(eventDocumentsApi, /event_promoters/);
});

console.log(`\nEvent organizer checks passed: ${passed}`);
