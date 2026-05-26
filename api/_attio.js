/**
 * Attio API client.
 * Docs:
 * - Identify token: https://docs.attio.com/rest-api/endpoint-reference/meta/identify
 * - Upsert person: https://docs.attio.com/rest-api/endpoint-reference/people/upsert-a-person-record
 *
 * IMPORTANT: Never import this in frontend code.
 * ATTIO_ACCESS_TOKEN must stay server-side only.
 */

const BASE = 'https://api.attio.com/v2';

function authHeader() {
  const token = process.env.ATTIO_ACCESS_TOKEN;
  if (!token) throw new Error('Attio token not configured');
  return `Bearer ${token}`;
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function attioFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  const data = await readJson(res);
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      data?.errors?.[0]?.message ||
      `Attio error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status, body: data });
  }

  return data;
}

export function getAttioConfigStatus() {
  return {
    hasToken: Boolean(process.env.ATTIO_ACCESS_TOKEN),
    workspaceId: process.env.ATTIO_WORKSPACE_ID || null,
    peopleObject: process.env.ATTIO_PEOPLE_OBJECT || 'people',
  };
}

export async function identifyAttio() {
  return attioFetch('/self');
}

function splitName(fullName = '') {
  const clean = String(fullName || '').trim();
  if (!clean) return { firstName: '', lastName: '', fullName: '' };
  const parts = clean.split(/\s+/);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    fullName: clean,
  };
}

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).trim();
}

export function buildPersonValues(client = {}) {
  const fullName = client.name || [client.firstName, client.lastName].filter(Boolean).join(' ');
  const parsedName = splitName(fullName);
  const values = {};

  if (client.email) values.email_addresses = [String(client.email).trim().toLowerCase()];
  if (parsedName.fullName) {
    values.name = [{
      first_name: client.firstName || parsedName.firstName || null,
      last_name: client.lastName || parsedName.lastName || null,
      full_name: parsedName.fullName,
    }];
  }
  const phone = normalizePhone(client.phone);
  if (phone) values.phone_numbers = [{ original_phone_number: phone, country_code: 'US' }];

  const description = [
    client.source ? `Source: ${client.source}` : null,
    client.lifecycleStage ? `Lifecycle: ${client.lifecycleStage}` : null,
    client.service ? `Requested: ${client.service}` : null,
    client.planInterest ? `Plan interest: ${client.planInterest}` : null,
    client.visitCount != null ? `Visit count: ${client.visitCount}` : null,
  ].filter(Boolean).join('\n');

  if (description) values.description = description;
  return values;
}

export async function upsertAttioPerson(client = {}) {
  const values = buildPersonValues(client);
  if (!values.email_addresses?.length) {
    throw Object.assign(new Error('Email is required to sync a person to Attio'), { status: 400 });
  }

  return attioFetch('/objects/people/records?matching_attribute=email_addresses', {
    method: 'PUT',
    body: JSON.stringify({ data: { values } }),
  });
}
