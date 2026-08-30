import { getDefaultTenantId, getSupabaseServiceClient } from './_supabase-server.js';
import { CatalogError, loadCatalogGraph, projectClientCatalog } from './_lib/catalog-core.js';
import { safeLogContext } from './_lib/safe-error.js';

function unavailable(res, error) {
  console.warn('[catalog/public] unavailable', safeLogContext(error, 'catalog_public_unavailable'));
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(503).json({
    error: 'The service menu is temporarily unavailable.',
    code: 'OperationalSourceUnavailable',
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (String(req.query?.audience || 'client') !== 'client') {
    return res.status(400).json({ error: 'Unsupported Catalog audience.', code: 'invalid_catalog_audience' });
  }

  try {
    const db = await getSupabaseServiceClient();
    const tenantId = await getDefaultTenantId(db);
    if (!db || !tenantId) return unavailable(res, new CatalogError('catalog_not_configured', 'Catalog storage is unavailable.', 503));
    const graph = await loadCatalogGraph(db, tenantId);
    const projection = projectClientCatalog(graph, {
      audience: 'client',
      channel: 'public_website',
      now: new Date(),
    });
    // V1 has no coordinated CDN purge yet. No-store keeps hide/archive/price
    // changes immediate and prevents stale commerce data after approval.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(projection);
  } catch (error) {
    return unavailable(res, error);
  }
}
