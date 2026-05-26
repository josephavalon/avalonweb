export const MERCURY_ENV_KEYS = {
  apiKey: 'MERCURY_API_KEY',
  accountId: 'MERCURY_ACCOUNT_ID',
  webhookSecret: 'MERCURY_WEBHOOK_SECRET',
};

export const GUSTO_ENV_KEYS = {
  clientId: 'GUSTO_CLIENT_ID',
  companyId: 'GUSTO_COMPANY_ID',
  redirectUri: 'GUSTO_REDIRECT_URI',
};

export const QUICKBOOKS_ENV_KEYS = {
  clientId: 'QUICKBOOKS_CLIENT_ID',
  realmId: 'QUICKBOOKS_REALM_ID',
  redirectUri: 'QUICKBOOKS_REDIRECT_URI',
};

export const QUALIPHY_ENV_KEYS = {
  apiKey: 'QUALIPHY_API_KEY',
  clinicId: 'QUALIPHY_CLINIC_ID',
  webhookSecret: 'QUALIPHY_WEBHOOK_SECRET',
};

export const NURSEYS_ENV_KEYS = {
  apiKey: 'NURSEYS_API_KEY',
  accountId: 'NURSEYS_ACCOUNT_ID',
  webhookSecret: 'NURSEYS_WEBHOOK_SECRET',
};

export const MERCURY_BANKING_PLACEHOLDER = {
  service: 'Mercury Banking',
  badgeStatus: 'Placeholder',
  mode: 'Bank Pending',
  envKeys: MERCURY_ENV_KEYS,
  description: 'Operating banking for deposits, refunds, reimbursements, and cash visibility.',
  capabilities: [
    'Track Stripe/Acuity deposits into operating cash',
    'Flag refunds and reimbursements for admin review',
    'Keep clinical notes and GFE details out of banking payloads',
  ],
};

export const GUSTO_PAYROLL_PLACEHOLDER = {
  service: 'Gusto Payroll',
  badgeStatus: 'Placeholder',
  mode: 'Payroll Pending',
  envKeys: GUSTO_ENV_KEYS,
  description: 'Payroll destination for nurse pay, mileage, reimbursements, and contractor proof.',
  capabilities: [
    'Queue pay only after Acuity closeout is complete',
    'Export shift value, miles, reimbursements, and nurse identity',
    'Exclude client PHI, clinical notes, and GFE content',
  ],
};

export const QUICKBOOKS_ACCOUNTING_PLACEHOLDER = {
  service: 'QuickBooks Accounting',
  badgeStatus: 'Placeholder',
  mode: 'Books Pending',
  envKeys: QUICKBOOKS_ENV_KEYS,
  description: 'Accounting destination for invoices, deposits, payouts, reimbursements, and reconciliation summaries.',
  capabilities: [
    'Mirror paid deposits and invoices after admin review',
    'Receive Mercury/Gusto summary lines without PHI',
    'Support bookkeeping reconciliation without exposing clinical notes',
  ],
};

export const QUALIPHY_GFE_PLACEHOLDER = {
  service: 'Qualiphy / Qualify GFE Fallback',
  badgeStatus: 'Placeholder',
  mode: 'Fallback Pending',
  envKeys: QUALIPHY_ENV_KEYS,
  description: 'Fallback GFE lane only when no Avalon remote NP is on call.',
  capabilities: [
    'Avalon NP routing remains first priority',
    'Fallback triggers only when the NP roster has no active coverage',
    'Client receives GFE completion prompt before event or visit arrival',
  ],
};

export const NURSEYS_CREDENTIAL_PLACEHOLDER = {
  service: 'Nurseys Credential Filter',
  badgeStatus: 'Placeholder',
  mode: 'Credential Pending',
  envKeys: NURSEYS_ENV_KEYS,
  description: 'Credential eligibility gate for nurses before shift assignment.',
  capabilities: [
    'Allow only Nurseys-clear nurses to accept shifts',
    'Track state, expiration, and review status locally until API credentials exist',
    'Block assignment when credential status is Review, Expiring, or missing',
  ],
};

export const FINANCE_HANDOFF_CONTRACT = [
  'Client payment: Stripe or Acuity',
  'Banking: Mercury',
  'Payroll: Gusto',
  'Books: QuickBooks',
  'Avalon stores only operational proof, never clinical notes in finance exports',
];

export const PLACEHOLDER_INTEGRATIONS = [
  MERCURY_BANKING_PLACEHOLDER,
  GUSTO_PAYROLL_PLACEHOLDER,
  QUICKBOOKS_ACCOUNTING_PLACEHOLDER,
  QUALIPHY_GFE_PLACEHOLDER,
  NURSEYS_CREDENTIAL_PLACEHOLDER,
];

export function isMercuryConfigured(env = import.meta.env) {
  return Boolean(
    env?.[MERCURY_ENV_KEYS.apiKey] &&
    env?.[MERCURY_ENV_KEYS.accountId]
  );
}

export function isGustoConfigured(env = import.meta.env) {
  return Boolean(
    env?.[GUSTO_ENV_KEYS.clientId] &&
    env?.[GUSTO_ENV_KEYS.companyId]
  );
}

export function isQuickBooksConfigured(env = import.meta.env) {
  return Boolean(
    env?.[QUICKBOOKS_ENV_KEYS.clientId] &&
    env?.[QUICKBOOKS_ENV_KEYS.realmId]
  );
}

export function isQualiphyConfigured(env = import.meta.env) {
  return Boolean(
    env?.[QUALIPHY_ENV_KEYS.apiKey] &&
    env?.[QUALIPHY_ENV_KEYS.clinicId]
  );
}

export function isNurseysConfigured(env = import.meta.env) {
  return Boolean(
    env?.[NURSEYS_ENV_KEYS.apiKey] &&
    env?.[NURSEYS_ENV_KEYS.accountId]
  );
}

export function integrationConfigured(service, env = import.meta.env) {
  if (service === MERCURY_BANKING_PLACEHOLDER.service) return isMercuryConfigured(env);
  if (service === GUSTO_PAYROLL_PLACEHOLDER.service) return isGustoConfigured(env);
  if (service === QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service) return isQuickBooksConfigured(env);
  if (service === QUALIPHY_GFE_PLACEHOLDER.service) return isQualiphyConfigured(env);
  if (service === NURSEYS_CREDENTIAL_PLACEHOLDER.service) return isNurseysConfigured(env);
  return false;
}
