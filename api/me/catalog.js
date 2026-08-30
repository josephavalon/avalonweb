import { requireRole } from '../_lib/supabase-auth.js';
import { CatalogError, loadCatalogGraph, projectNurseCatalog } from '../_lib/catalog-core.js';
import { safeLogContext } from '../_lib/safe-error.js';

const NURSE_MENU_ROLES = Object.freeze(['nurse', 'rn', 'np', 'physician', 'medical_director', 'admin']);

function unavailable(res, error) {
  console.warn('[catalog/nurse] unavailable', safeLogContext(error, 'catalog_nurse_unavailable'));
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(503).json({
    error: 'The nurse service menu is temporarily unavailable.',
    code: 'OperationalSourceUnavailable',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (String(req.query?.audience || 'nurse') !== 'nurse') {
    return res.status(400).json({ error: 'Unsupported Catalog audience.', code: 'invalid_catalog_audience' });
  }
  const authed = await requireRole(req, res, NURSE_MENU_ROLES);
  if (!authed) return;
  if (!authed.tenantId) return unavailable(res, new CatalogError('catalog_tenant_missing', 'Catalog tenant is unavailable.', 503));

  try {
    const graph = await loadCatalogGraph(authed.db, authed.tenantId);
    const projection = projectNurseCatalog(graph, {
      audience: 'nurse',
      provider_role: authed.role,
      channel: 'nurse_portal',
      now: new Date(),
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json(projection);
  } catch (error) {
    return unavailable(res, error);
  }
}
