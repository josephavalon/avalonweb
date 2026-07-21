#!/usr/bin/env node
/**
 * Smoke-test the admin team invite flow against a real Supabase project/API.
 *
 * Required env:
 *   API_BASE_URL=https://snooches.avalonvitality.co
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VERIFY_EMAIL_ROOT=qa@example.com when running against snooches/production
 *
 * The script creates a temporary _test tenant and admin, calls the invite API,
 * patches the pending invite to known test token/code values, then exercises
 * /api/invite/validate and /api/invite/accept.
 */
import { createClient } from '@supabase/supabase-js';
import { hashCode, hashToken } from '../api/_lib/invite-token.js';

const apiBase = String(process.env.API_BASE_URL || process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const verifyEmailRoot = String(process.env.VERIFY_EMAIL_ROOT || '').trim().toLowerCase();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { error: text }; }
  if (!res.ok) {
    throw new Error(body?.error || `${path} returned HTTP ${res.status}`);
  }
  return body || {};
}

if (!apiBase || !supabaseUrl || !anon || !serviceKey) {
  fail('Set API_BASE_URL, Supabase URL, anon key, and service-role key.');
}

function isProductionTarget(value) {
  try {
    const host = new URL(value).hostname;
    return !['localhost', '127.0.0.1', '0.0.0.0'].includes(host);
  } catch {
    return true;
  }
}

function taggedEmail(tag, fallbackPrefix) {
  const safeTag = String(tag || Date.now()).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'verify';
  if (verifyEmailRoot) {
    const match = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec(verifyEmailRoot);
    if (!match) fail('VERIFY_EMAIL_ROOT must be an email address like qa@example.com.');
    return `${match[1]}+${safeTag}@${match[2]}`;
  }
  return `${fallbackPrefix}-${safeTag}@example.test`;
}

if (isProductionTarget(apiBase) && !verifyEmailRoot) {
  fail('Set VERIFY_EMAIL_ROOT to a human-owned mailbox, e.g. qa@example.com, so production email delivery is verified without using example.test.');
}

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(supabaseUrl, anon, { auth: { persistSession: false, autoRefreshToken: false } });

const nonce = Date.now();
const tenantSlug = `avalon-vitality-test-${nonce}`;
const adminEmail = taggedEmail(`verify-admin-${nonce}`, 'verify-admin');
const adminPassword = `VerifyAdmin-${nonce}-x9`;
const code = '424242';
let tenantId = null;
let adminUserId = null;
const invitedUserIds = [];
const createdEmails = new Set([adminEmail]);
const inviteIds = [];

async function verifyInviteRole({ bearer, role, method = 'token' }) {
  const inviteEmail = taggedEmail(`verify-${role}-${nonce}`, `verify-${role}`);
  createdEmails.add(inviteEmail);
  const invitePassword = `Verify${role[0].toUpperCase()}${role.slice(1)}-${nonce}-x9`;
  const token = `verify-token-${role}-${nonce}`;
  const fullName = `Verify ${role[0].toUpperCase()}${role.slice(1)}`;

  const inviteResult = await jsonFetch('/api/admin/team/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({
      email: inviteEmail,
      role,
      fullName,
      delivery: 'email',
    }),
  });
  if (!inviteResult.inviteId) fail(`Invite API did not return inviteId for ${role}.`);
  inviteIds.push(inviteResult.inviteId);

  const { error: patchError } = await admin.from('invitations').update({
    token_hash: hashToken(token),
    code_hash: hashCode(inviteEmail, code),
    status: 'pending',
    locked_at: null,
    failed_attempts: 0,
    updated_at: new Date().toISOString(),
  }).eq('id', inviteResult.inviteId);
  if (patchError) throw patchError;

  const inviteProof = method === 'code'
    ? { email: inviteEmail, code }
    : { token };

  const validation = await jsonFetch('/api/invite/validate', {
    method: 'POST',
    body: JSON.stringify(inviteProof),
  });
  if (!validation.ok || validation.email !== inviteEmail || validation.role !== role) {
    fail(`Invite validation did not return expected ${role} invite.`);
  }

  const accepted = await jsonFetch('/api/invite/accept', {
    method: 'POST',
    body: JSON.stringify({ ...inviteProof, password: invitePassword, fullName }),
  });
  if (!accepted.ok) fail(`Invite accept for ${role} did not return ok=true.`);

  const { data: profile, error: acceptedProfileError } = await admin.from('profiles')
    .select('id, role, tenant_id, status, must_change_password')
    .eq('email', inviteEmail)
    .maybeSingle();
  if (acceptedProfileError) throw acceptedProfileError;
  if (profile?.id) invitedUserIds.push(profile.id);
  if (!profile) fail(`Accepted ${role} profile was not created.`);
  if (profile.role !== role) fail(`Expected role=${role}, got ${profile.role}.`);
  if (profile.tenant_id !== tenantId) fail(`Accepted ${role} profile tenant_id did not match _test tenant.`);
  if (profile.status !== 'active') fail(`Expected status=active for ${role}, got ${profile.status}.`);
  if (profile.must_change_password !== false) fail(`Expected must_change_password=false for ${role}.`);

  console.log(`PASS: team invite ${method} validate/accept created an active ${role} profile.`);
}

try {
  const { data: tenant, error: tenantError } = await admin.from('tenants')
    .insert({ name: 'Avalon Verify _test', slug: tenantSlug })
    .select('id')
    .single();
  if (tenantError) throw tenantError;
  tenantId = tenant.id;

  const { data: createdAdmin, error: adminCreateError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });
  if (adminCreateError) throw adminCreateError;
  adminUserId = createdAdmin?.user?.id;
  if (!adminUserId) fail('No temp admin user id.');

  const { error: profileError } = await admin.from('profiles').upsert({
    id: adminUserId,
    email: adminEmail,
    role: 'admin',
    status: 'active',
    tenant_id: tenantId,
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (signInError) throw signInError;
  const bearer = signedIn?.session?.access_token;
  if (!bearer) fail('No temp admin access token.');

  await verifyInviteRole({ bearer, role: 'staff', method: 'token' });
  await verifyInviteRole({ bearer, role: 'admin', method: 'code' });
} catch (err) {
  fail(err?.message || err);
} finally {
  if (inviteIds.length) {
    await admin.from('invitations').delete().in('id', inviteIds).catch(() => {});
  }
  for (const invitedUserId of invitedUserIds) {
    await admin.auth.admin.deleteUser(invitedUserId).catch(() => {});
  }
  if (adminUserId) await admin.auth.admin.deleteUser(adminUserId).catch(() => {});
  for (const email of createdEmails) {
    await admin.from('profiles').delete().eq('email', email).catch(() => {});
    await admin.from('invitations').delete().eq('email', email).catch(() => {});
  }
  if (tenantId) await admin.from('tenants').delete().eq('id', tenantId).catch(() => {});
}
