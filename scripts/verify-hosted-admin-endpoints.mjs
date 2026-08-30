#!/usr/bin/env node
/**
 * Hosted smoke for the admin APIs that the launch admin UI calls. This is safe
 * to run without credentials: it only asserts the functions exist and fail
 * closed for unauthenticated/unsupported requests.
 */

const baseUrl = String(process.env.API_BASE_URL || process.env.PUBLIC_SITE_URL || 'https://www.avalonvitality.co').replace(/\/$/, '');

if (!/^https:\/\/[^/]+/.test(baseUrl)) {
  console.error('FAIL: API_BASE_URL must be an HTTPS origin.');
  process.exit(1);
}

const routeChecks = [
  '/admin/login',
  '/admin/robbot3k',
  '/admin/bd',
  '/admin/scheduling',
  '/admin/nurse-invoices',
  '/provider/shifts',
  '/provider/invoices',
];

const apiChecks = [
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
  {
    label: 'admin Nurse Invoices',
    path: '/api/admin/nurse-invoices',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'admin Scheduling',
    path: '/api/admin/scheduling',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'provider Shifts',
    path: '/api/me/shifts',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'provider Nurse Invoices',
    path: '/api/me/nurse-invoices',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'admin Avalon BD',
    path: '/api/admin/bd?view=dashboard',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'admin RobBot3K',
    path: '/api/admin/robbot3k',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'RobBot3K morning cron',
    path: '/api/cron/robbot3k-morning',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'RobBot3K executor cron',
    path: '/api/cron/robbot3k-execute',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
  {
    label: 'Finance invoice notification cron',
    path: '/api/cron/nurse-invoice-notifications',
    method: 'GET',
    acceptedStatuses: [401, 503],
    blockedStatus: 404,
  },
];

let failed = false;

for (const path of routeChecks) {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'manual' });
    const location = response.headers.get('location') || '';
    if (response.status === 404 || response.status >= 500) {
      failed = true;
      console.error(`FAIL: Admin route returned ${response.status} at ${url}`);
      continue;
    }
    if (location && /\/(?:start|book|login)(?:[/?#]|$)/i.test(location) && !/\/admin\/login(?:[/?#]|$)/i.test(location)) {
      failed = true;
      console.error(`FAIL: Admin route escaped to consumer flow at ${location}`);
      continue;
    }
    console.log(`PASS: Admin route returned ${response.status} at ${url}`);
  } catch (err) {
    failed = true;
    console.error(`FAIL: Admin route request failed at ${url}: ${err?.message || err}`);
  }
}

for (const check of apiChecks) {
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
