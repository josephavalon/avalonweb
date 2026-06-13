import { apiGet, apiPost } from './apiClient';

export const ATTIO_ENV_KEYS = {
  accessToken: 'ATTIO_ACCESS_TOKEN',
  workspaceId: 'ATTIO_WORKSPACE_ID',
  peopleObject: 'ATTIO_PEOPLE_OBJECT',
};

export const ATTIO_INTEGRATION = {
  service: 'Attio CRM',
  badgeStatus: 'Server-side',
  mode: 'Needs Server Token',
  envKeys: ATTIO_ENV_KEYS,
  description: 'Server-side CRM sync for client people records. Access token stays out of browser code.',
  capabilities: [
    'Create or update client people records',
    'Track source, lifecycle stage, visit count, and plan interest',
    'Queue follow-ups for rebook, payment, review, and plan outreach',
    'Keep clinical notes and protected health details out of CRM sync',
  ],
  lifecycleStages: ['Lead', 'Booked', 'Active Client', 'Plan Lead', 'VIP', 'Needs Follow-Up'],
};

export const ATTIO_PLACEHOLDER = ATTIO_INTEGRATION;

export function isAttioConfigured(env = import.meta.env) {
  return env?.VITE_ATTIO_CONFIGURED === 'true';
}

export async function checkAttioConnection() {
  return apiGet('/api/integrations/attio/test');
}

export async function syncAttioPerson(client) {
  return apiPost('/api/integrations/attio/upsert-person', { client });
}

export function buildAttioClientPayload(client = {}) {
  return {
    name: client.name || [client.firstName, client.lastName].filter(Boolean).join(' '),
    email: client.email,
    phone: client.phone,
    source: client.source || 'Website',
    lifecycleStage: client.lifecycleStage || 'Lead',
    tags: client.tags || [],
    city: client.city,
    lastVisitAt: client.lastVisitAt,
    visitCount: client.visitCount,
    totalSpend: client.totalSpend,
    planInterest: client.planInterest,
  };
}
