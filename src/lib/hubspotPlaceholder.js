import { apiGet, apiPatch, apiPost } from './apiClient';

export const HUBSPOT_ENV_KEYS = {
  accessToken: 'Server access token (private-app)',
  portalId: 'Portal id (for admin deep links)',
  syncEnabled: 'HUBSPOT_SYNC_ENABLED kill switch',
};

export const HUBSPOT_INTEGRATION = {
  service: 'HubSpot CRM',
  badgeStatus: 'Server-side',
  mode: 'Needs Server Token',
  envKeys: HUBSPOT_ENV_KEYS,
  description: 'Server-side hospitality CRM. Identifiers + guest-profile preferences only. Never sends PHI — enforced by the server-side allowlist.',
  capabilities: [
    'Upsert contacts on signup and consent (no PHI)',
    'Track hospitality guest profile (social handles, style, wardrobe, beverage, music, notes)',
    'Track lifecycle stage, source, plan interest, visit count',
    'Keep clinical notes and protected health details out of the CRM',
  ],
  lifecycleStages: ['Lead', 'Booked', 'Active Client', 'Plan Lead', 'VIP', 'Needs Follow-Up'],
};

export const HUBSPOT_PLACEHOLDER = HUBSPOT_INTEGRATION;

export function isHubspotConfigured(env = import.meta.env) {
  return env?.VITE_HUBSPOT_CONFIGURED === 'true';
}

export async function checkHubspotConnection() {
  return apiGet('/api/integrations/hubspot/test');
}

export async function syncHubspotContact(client) {
  return apiPost('/api/integrations/hubspot/upsert-contact', { client });
}

export async function saveGuestProfile({ profileId, guestProfile }) {
  return apiPatch('/api/admin/guest-profile', { profileId, guestProfile });
}

export function buildHubspotClientPayload(client = {}) {
  const gp = client.guestProfile || {};
  return {
    name: client.name || [client.firstName, client.lastName].filter(Boolean).join(' '),
    email: client.email,
    phone: client.phone,
    city: client.city,
    source: client.source || 'Website',
    lifecycleStage: client.lifecycleStage || 'Lead',
    planInterest: client.planInterest || '',
    visitCount: client.visitCount,
    guestProfile: {
      instagram: gp.instagram || '',
      tiktok: gp.tiktok || '',
      linkedin: gp.linkedin || '',
      style: gp.style || '',
      wardrobe: gp.wardrobe || '',
      beverage: gp.beverage || '',
      music: gp.music || '',
      notes: gp.notes || '',
      context: gp.context || '',
    },
  };
}

export const HUBSPOT_GUEST_PROFILE_FIELDS = [
  { key: 'instagram', label: 'Instagram', placeholder: '@handle', kind: 'short' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@handle', kind: 'short' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...', kind: 'short' },
  { key: 'beverage', label: 'Favorite drink', placeholder: 'oat milk latte', kind: 'short' },
  { key: 'music', label: 'Music preference', placeholder: 'Norah Jones, Zero 7', kind: 'short' },
  { key: 'style', label: 'Style notes', placeholder: 'prefers loose sleeves, cold rooms bother her', kind: 'long' },
  { key: 'wardrobe', label: 'Wardrobe notes', placeholder: 'brings own robe, size M', kind: 'long' },
  { key: 'context', label: 'Visit context', placeholder: 'referred by Sarah in accounts; VP at a studio', kind: 'long' },
  { key: 'notes', label: 'Hospitality notes ("anything to help")', placeholder: 'birthday March 14, dog named Biscuit', kind: 'long' },
];
