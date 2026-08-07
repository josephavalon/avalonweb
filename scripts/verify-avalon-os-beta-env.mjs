import process from 'node:process';

const env = process.env;
const errors = [];
const value = (name) => String(env[name] || '').trim();
const requireValue = (name) => { if (!value(name)) errors.push(`${name} is required`); };

for (const name of [
  'AVALON_OS_BETA', 'VITE_AVALON_OS_BETA', 'PUBLIC_SITE_URL', 'VITE_PUBLIC_SITE_URL',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
  'AVALON_BETA_SUPABASE_PROJECT_REF', 'STRIPE_SECRET_KEY', 'VITE_STRIPE_PUBLISHABLE_KEY',
  'ACUITY_USER_ID', 'ACUITY_API_KEY', 'ACUITY_BETA_CALENDAR_ID',
  'BETA_EMAIL_RECIPIENT_ALLOWLIST', 'BETA_SMS_RECIPIENT_ALLOWLIST',
]) requireValue(name);

if (value('AVALON_OS_BETA') !== 'true' || value('VITE_AVALON_OS_BETA') !== 'true') errors.push('both Avalon OS beta flags must equal true');
if (value('VITE_AVALON_DEMO_AUTH') !== 'false') errors.push('VITE_AVALON_DEMO_AUTH must equal false');
for (const name of ['PUBLIC_SITE_URL', 'VITE_PUBLIC_SITE_URL']) {
  if (value(name) !== 'https://beta.avalonvitality.co') errors.push(`${name} must be the beta URL`);
}
const projectRef = value('AVALON_BETA_SUPABASE_PROJECT_REF');
for (const name of ['SUPABASE_URL', 'VITE_SUPABASE_URL']) {
  if (projectRef && !value(name).includes(`${projectRef}.supabase.co`)) errors.push(`${name} must match the declared beta Supabase project ref`);
}
if (!value('STRIPE_SECRET_KEY').startsWith('sk_test_')) errors.push('STRIPE_SECRET_KEY must be Stripe test mode');
if (!value('VITE_STRIPE_PUBLISHABLE_KEY').startsWith('pk_test_')) errors.push('VITE_STRIPE_PUBLISHABLE_KEY must be Stripe test mode');
if (/avalonvitality\.co/i.test(value('BETA_EMAIL_RECIPIENT_ALLOWLIST'))) errors.push('beta email recipients must be test-only, not Avalon production addresses');
if (value('VERCEL_PROJECT_ID') && value('VERCEL_PROJECT_ID') !== 'prj_smizqQYWmruc0rbuWIulXxKUMQvD') errors.push('VERCEL_PROJECT_ID is not avalonweb-beta');
if (value('VERCEL_ENV') === 'production') errors.push('Avalon OS beta releases must not use the Vercel production target');
if (/live|prod/i.test(`${value('SUPABASE_URL')} ${projectRef} ${value('ACUITY_BETA_CALENDAR_ID')}`)) errors.push('a staging identifier appears to contain live/prod');

if (errors.length) {
  console.error('Avalon OS beta environment refused:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Avalon OS beta environment is isolated: beta URLs, staging Supabase, Stripe test mode, Acuity beta calendar, restricted recipients, and non-production Vercel target.');
