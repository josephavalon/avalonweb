/**
 * Events platform RLS + PHI-invariant drill (eng review 13A + T5, blueprint F).
 *
 * Two layers:
 *   [static] invariants checked against the migration SQL itself — always runs,
 *            no DB needed. Guards the PHI posture at the schema-text level:
 *            no health-content columns on events tables, RLS enabled on every
 *            events table, append-only audit, promoter isolation, role CHECK.
 *   [live]   role-matrix deny drill against a real Supabase project — runs only
 *            when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY
 *            are set AND migration 034 is applied. Creates throwaway users per
 *            role, asserts the access matrix, cleans up.
 *
 * Run:  node scripts/verify-events-rls.mjs            (static only)
 *       LIVE=1 node scripts/verify-events-rls.mjs     (static + live)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.join(__dirname, '..', 'supabase', 'migrations', '034_events_platform_core.sql');
const sql = readFileSync(MIGRATION, 'utf8');

let passed = 0;
function check(name, fn) {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
}

// Every events table created in 034.
const EVENT_TABLES = [
  'service_providers', 'event_services', 'event_containers', 'event_container_private',
  'event_themes', 'event_tiers', 'event_catalog_items', 'event_menu_presets',
  'event_package_items', 'event_visits', 'event_orders', 'event_applications',
  'event_waitlist', 'event_invites', 'event_queue_entries', 'event_assets',
  'event_promoters', 'event_audit_log',
];

console.log('\n[static 1] Schema shape');
check('all 18 events tables are created', () => {
  for (const t of EVENT_TABLES) {
    assert.ok(
      sql.includes(`create table if not exists public.${t}`),
      `missing create table for ${t}`,
    );
  }
});
check('every events table is in the RLS enable loop', () => {
  const loop = sql.match(/foreach tbl in array array\[([\s\S]*?)\]/);
  assert.ok(loop, 'RLS enable loop not found');
  for (const t of EVENT_TABLES) {
    assert.ok(loop[1].includes(`'${t}'`), `${t} missing from RLS loop`);
  }
});
check('every events table carries tenant_id', () => {
  for (const t of EVENT_TABLES) {
    const body = sql.split(`create table if not exists public.${t}`)[1]?.split(');')[0] || '';
    assert.ok(/tenant_id\s+uuid/.test(body), `${t} has no tenant_id`);
  }
});
check('NO document/contract table in this migration (T9 trim)', () => {
  assert.ok(!/create table if not exists public\.(event_)?documents?\b/.test(sql));
});

console.log('\n[static 2] PHI invariants (blueprint amendment F)');
check('no flag_categories column anywhere (flags pulled at render, never stored)', () => {
  assert.ok(!sql.includes('flag_categories'));
});
check('no free-text health-shaped columns on events tables', () => {
  for (const bad of ['allergies', 'medications', 'diagnosis', 'conditions', 'medical_notes', 'clinical_notes', 'intake_answers']) {
    assert.ok(!sql.toLowerCase().includes(bad), `health-shaped column "${bad}" found`);
  }
});
check('gfe pointers only: acuity appt id + qualiphy ref, both text pointers', () => {
  assert.ok(sql.includes('gfe_acuity_appt_id  text'));
  assert.ok(sql.includes('gfe_qualiphy_ref    text'));
});
check('applications.answers carries the non-medical comment guard', () => {
  assert.ok(/answers\s+jsonb[^\n]*\n?[^\n]*ADMIT QUESTIONS ONLY/i.test(sql) || sql.includes('ADMIT QUESTIONS ONLY'));
});
check('exact address lives in the private side table, not the public container row', () => {
  assert.ok(!/create table if not exists public\.event_containers[\s\S]*?exact_address[\s\S]*?\n\);/.test(
    sql.split('create table if not exists public.event_container_private')[0],
  ), 'exact_address found on event_containers');
  assert.ok(sql.includes('event_container_private') && sql.includes('exact_address'));
});

console.log('\n[static 3] Access model (eng review 3A + F)');
check('profiles_role_check constraint added (incl. promoter, excl. door)', () => {
  assert.ok(sql.includes('profiles_role_check'));
  assert.ok(sql.includes("'promoter'"));
  assert.ok(!/check \(role in \([^)]*'door'/.test(sql), "door must be a token mode, not a role");
});
check('is_event_promoter helper mirrors the assigned-provider pattern', () => {
  assert.ok(sql.includes('app_private.is_event_promoter'));
  assert.ok(sql.includes('security definer'));
});
check('promoters have NO policy on visits, queue, orders, or waitlist', () => {
  // Split into individual policy statements: each starts at "create policy"
  // and ends at the first ";" — the target table is the `on public.X` inside
  // that same statement.
  const policies = sql.split(/(?=create policy )/g)
    .filter((chunk) => chunk.startsWith('create policy '))
    .map((chunk) => chunk.slice(0, chunk.indexOf(';') + 1));
  for (const t of ['event_visits', 'event_orders', 'event_queue_entries', 'event_waitlist']) {
    const bodies = policies.filter((p) => p.includes(`on public.${t}\n`) || p.includes(`on public.${t} `));
    assert.ok(bodies.length > 0, `no policies found for ${t}`);
    for (const b of bodies) {
      assert.ok(!b.includes('is_event_promoter'), `${t} policy references is_event_promoter:\n${b.slice(0, 200)}`);
      assert.ok(!b.includes("profile_role() = 'promoter'"), `${t} policy grants promoter role`);
    }
  }
});
check('audit log is append-only (update/delete revoked)', () => {
  assert.ok(sql.includes('revoke update, delete on public.event_audit_log'));
});
check('transition function is service_role-only', () => {
  assert.ok(sql.includes('revoke all on function public.transition_event_visit'));
  assert.ok(sql.includes('grant execute on function public.transition_event_visit(uuid, text, text, uuid, jsonb) to service_role'));
});
check('package composing cannot self-approve (with check pins na/pending)', () => {
  const m = sql.match(/create policy "event packages promoter compose"[\s\S]*?;/);
  assert.ok(m && m[0].includes("clinical_approval in ('na', 'pending')"));
});

console.log('\n[static 4] Hot-path indexes (eng review 14A)');
check('queue board, gfe, hold-reaper, waitlist-promotion indexes exist', () => {
  for (const idx of [
    'event_queue_entries_board_idx', 'event_visits_container_gfe_idx',
    'event_visits_hold_reaper_idx', 'event_waitlist_promotion_idx',
  ]) assert.ok(sql.includes(idx), `missing ${idx}`);
});

// ---------------------------------------------------------------------------
// Live role-matrix drill — runs only with LIVE=1 + env + migration applied.
// ---------------------------------------------------------------------------
const LIVE = process.env.LIVE === '1';
if (!LIVE) {
  console.log('\n[live] skipped (set LIVE=1 with SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY after applying 034)');
} else {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    console.error('  ✗ LIVE=1 but SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY missing');
    process.exitCode = 1;
  } else {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const stamp = Date.now();
    const users = {}; // role -> { id, client }
    const cleanup = [];

    async function makeUser(role) {
      const email = `rls-drill-${role}-${stamp}@example.test`;
      const password = `Drill!${stamp}${role}`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw new Error(`createUser(${role}): ${error.message}`);
      cleanup.push(() => admin.auth.admin.deleteUser(data.user.id));
      await admin.from('profiles').update({ role, status: 'active' }).eq('id', data.user.id);
      const client = createClient(url, anonKey, { auth: { persistSession: false } });
      const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
      if (signInErr) throw new Error(`signIn(${role}): ${signInErr.message}`);
      users[role] = { id: data.user.id, client };
      return users[role];
    }

    async function expectDenied(name, promise) {
      const { data, error } = await promise;
      const denied = error || !data || (Array.isArray(data) && data.length === 0);
      check(name, () => assert.ok(denied, `expected deny, got ${JSON.stringify(data)?.slice(0, 120)}`));
    }

    try {
      console.log('\n[live 1] Seed a draft event + visit via service role');
      const { data: container, error: cErr } = await admin.from('event_containers')
        .insert({ slug: `rls-drill-${stamp}`, name: 'RLS Drill', status: 'draft' })
        .select().single();
      if (cErr) throw new Error(`seed container: ${cErr.message}`);
      cleanup.push(() => admin.from('event_containers').delete().eq('id', container.id));
      const { data: visit, error: vErr } = await admin.from('event_visits')
        .insert({ container_id: container.id, attendee_name: 'Drill Guest', gfe_status: 'in_review' })
        .select().single();
      if (vErr) throw new Error(`seed visit: ${vErr.message}`);

      console.log('\n[live 2] Role matrix');
      await makeUser('promoter');
      await makeUser('client');

      // Unassigned promoter: cannot see the draft event, its visits, or queue.
      await expectDenied('promoter cannot read a draft event they are not assigned to',
        users.promoter.client.from('event_containers').select('id').eq('id', container.id));
      await expectDenied('promoter cannot read event_visits (GFE state) at all',
        users.promoter.client.from('event_visits').select('id, gfe_status').eq('container_id', container.id));
      await expectDenied('promoter cannot read the clinical queue',
        users.promoter.client.from('event_queue_entries').select('id').limit(1));
      await expectDenied('promoter cannot read orders/revenue rows of others',
        users.promoter.client.from('event_orders').select('id').limit(1));
      await expectDenied('client cannot read someone else\'s visit',
        users.client.client.from('event_visits').select('id').eq('id', visit.id));
      await expectDenied('client cannot read the exact address pre-confirmation',
        users.client.client.from('event_container_private').select('exact_address').eq('container_id', container.id));
      await expectDenied('anon key alone cannot read draft events',
        createClient(url, anonKey, { auth: { persistSession: false } })
          .from('event_containers').select('id').eq('id', container.id));

      // Assigned promoter CAN see their event but still not clinical state.
      await admin.from('event_promoters').insert({ profile_id: users.promoter.id, container_id: container.id });
      const { data: own } = await users.promoter.client.from('event_containers').select('id').eq('id', container.id);
      check('assigned promoter CAN read their own draft event', () => assert.ok(own?.length === 1));
      await expectDenied('assigned promoter STILL cannot read visits/gfe for their own event',
        users.promoter.client.from('event_visits').select('gfe_status').eq('container_id', container.id));
    } finally {
      for (const fn of cleanup.reverse()) { try { await fn(); } catch { /* best effort */ } }
    }
  }
}

console.log(`\n${process.exitCode ? 'FAIL' : 'PASS'} — ${passed} checks passed`);
