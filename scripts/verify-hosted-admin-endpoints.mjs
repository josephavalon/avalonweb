#!/usr/bin/env node
/**
 * Hosted smoke for the admin APIs that the launch admin UI calls. This is safe
 * to run without credentials: it only asserts the functions exist and fail
 * closed for unauthenticated/unsupported requests.
 */

const baseUrl = String(process.env.API_BASE_URL || process.env.PUBLIC_SITE_URL || 'https://snooches.avalonvitality.co').replace(/\/$/, '');

if (!/^https:\/\/[^/]+/.test(baseUrl)) {
  console.error('FAIL: API_BASE_URL must be an HTTPS origin.');
  process.exit(1);
}

const checks = [
  {
    label: 'admin finance summary',
    path: '/api/admin/finance/summary',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'admin Acuity retry',
    path: '/api/admin/bookings/retry-acuity',
    method: 'GET',
    acceptedStatuses: [405],
    blockedStatus: 404,
  },
];

let failed = false;

for (const check of checks) {
  const url = `${baseUrl}${check.path}`;
  try {
    const response = await fetch(url, { method: check.method, redirect: 'manual' });
    const body = await response.text();
    if (response.status === check.blockedStatus) {
      failed = true;
      console.error(`FAIL: ${check.label} returned ${response.status} at ${url}`);
      continue;
    }
    if (!check.acceptedStatuses.includes(response.status)) {
      failed = true;
      console.error(`FAIL: ${check.label} returned unexpected ${response.status} at ${url}`);
      console.error(body.slice(0, 300));
      continue;
    }
    console.log(`PASS: ${check.label} returned ${response.status} at ${url}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL: ${check.label} request failed: ${err?.message || err}`);
  }
}

if (failed) process.exit(1);
console.log('PASS: hosted admin endpoints are deployed and fail closed.');
