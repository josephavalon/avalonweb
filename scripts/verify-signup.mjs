#!/usr/bin/env node
/**
 * Verify the auth.users -> public.profiles trigger for client signup defaults.
 *
 * Required env:
 *   SUPABASE_URL or VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VERIFY_EMAIL_ROOT=qa@example.com when running against snooches/production
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const verifyEmailRoot = String(process.env.VERIFY_EMAIL_ROOT || '').trim().toLowerCase();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!url || !serviceKey) fail('Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');

function isProductionTarget(value) {
  try {
    const host = new URL(value).hostname;
    return !['localhost', '127.0.0.1', '0.0.0.0'].includes(host);
  } catch {
    return true;
  }
}

function taggedEmail(tag) {
  const safeTag = String(tag || Date.now()).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'verify';
  if (verifyEmailRoot) {
    const match = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec(verifyEmailRoot);
    if (!match) fail('VERIFY_EMAIL_ROOT must be an email address like qa@example.com.');
    return `${match[1]}+${safeTag}@${match[2]}`;
  }
  return `${safeTag}@example.test`;
}

if (isProductionTarget(url) && !verifyEmailRoot) {
  fail('Set VERIFY_EMAIL_ROOT to a human-owned mailbox, e.g. qa@example.com, so production signup verification does not use example.test.');
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const email = taggedEmail(`verify-signup-${Date.now()}`);
let userId = null;

try {
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: 'Verify Signup' },
  });
  if (createError) throw createError;
  userId = created?.user?.id;
  if (!userId) fail('Supabase did not return a user id.');

  let profile = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await db.from('profiles')
      .select('id, email, role, tenant_id, status, tenants:tenant_id(slug)')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data) { profile = data; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!profile) fail('No public.profiles row was created.');
  if (profile.role !== 'client') fail(`Expected role=client, got ${profile.role}.`);
  if (profile.status !== 'active') fail(`Expected status=active, got ${profile.status}.`);
  if (profile.tenants?.slug !== 'avalon-vitality') fail(`Expected tenant slug avalon-vitality, got ${profile.tenants?.slug || 'null'}.`);

  console.log('PASS: signup trigger created an active client profile in avalon-vitality.');
} catch (err) {
  fail(err?.message || err);
} finally {
  if (userId) {
    await db.from('profiles').delete().eq('id', userId).catch(() => {});
    await db.auth.admin.deleteUser(userId).catch(() => {});
  }
}
