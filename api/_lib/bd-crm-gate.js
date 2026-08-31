const READY_VALUE = 'true';

export function bdCrmEnabled(env = process.env) {
  return String(env?.AVALON_BD_CRM_ENABLED || '').trim().toLowerCase() === READY_VALUE;
}

export function requireBdCrmEnabled(res, env = process.env) {
  if (bdCrmEnabled(env)) return true;
  res.setHeader?.('Cache-Control', 'no-store');
  res.status(503).json({
    error: 'Avalon BD is not enabled for this environment.',
    code: 'bd_crm_disabled',
  });
  return false;
}
