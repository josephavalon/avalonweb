#!/usr/bin/env node
/**
 * Verify Supabase accepts a password-recovery request for a real auth user.
 * Hosted Supabase Auth does not expose a portable email-queue inspection API,
 * so this script verifies the request path and redirect target; the operator
 * confirms mailbox/provider delivery during the manual launch drill.
 *
 * Required env:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VERIFY_EMAIL_ROOT=qa@example.com when running against snooches/production
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const redirectTo = process.env.PASSWORD_RESET_REDIRECT_TO || 'https://snooches.avalonvitality.co/account/new-password';
const verifyEmailRoot = String(process.env.VERIFY_EMAIL_ROOT || '').trim().toLowerCase();

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

if (!url || !anon || !serviceKey) fail('Set Supabase URL, anon key, and service-role key.');

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
  fail('Set VERIFY_EMAIL_ROOT to a human-owned mailbox, e.g. qa@example.com, so password reset email delivery is verified without using example.test.');
}

try {
  const redirect = new URL(redirectTo);
  if (redirect.pathname !== '/account/new-password') {
    fail('PASSWORD_RESET_REDIRECT_TO must point to /account/new-password.');
  }
  if (isProductionTarget(url) && redirect.protocol !== 'https:') {
    fail('PASSWORD_RESET_REDIRECT_TO must be HTTPS for hosted verification.');
  }
} catch {
  fail('PASSWORD_RESET_REDIRECT_TO must be a valid absolute URL.');
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const email = taggedEmail(`verify-password-reset-${Date.now()}`);
let userId = null;

try {
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password: `Verify-${Date.now()}-x9`,
    email_confirm: true,
  });
  if (createError) throw createError;
  userId = data?.user?.id;
  if (!userId) fail('Supabase did not return a user id.');

  const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) throw resetError;

  console.log('PASS: Supabase accepted the password recovery request.');
  console.log('INFO: Confirm delivery in the VERIFY_EMAIL_ROOT mailbox or email provider logs.');
  console.log(`INFO: Recovery redirect target was ${redirectTo}`);
} catch (err) {
  fail(err?.message || err);
} finally {
  if (userId) {
    await admin.from('profiles').delete().eq('id', userId).catch(() => {});
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
}
