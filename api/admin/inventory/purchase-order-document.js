import { requireConnectedInventory, requireInventoryCanaryProfile } from '../../_lib/connected-inventory.js';
import { sendConnectedInventoryError } from '../../_lib/connected-inventory-api.js';
import { cleanUuid, PayOpsError } from '../../_lib/payops-core.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function money(cents) { return `$${(Number(cents || 0) / 100).toFixed(2)}`; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  try {
    requireConnectedInventory('manualProcurement');
    requireInventoryCanaryProfile(authed.user.id);
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    const id = cleanUuid(req.query?.id, 'purchaseOrderId');
    const poResult = await authed.db.from('os_purchase_orders')
      .select('id,order_number,status,expected_on,subtotal_cents,tax_cents,shipping_cents,payload,payload_hash,approved_payload_hash,approved_at,vendor_id,ship_to_location_id')
      .eq('tenant_id', authed.tenantId).eq('id', id).maybeSingle();
    if (poResult.error) throw poResult.error;
    const po = poResult.data;
    if (!po || !po.approved_payload_hash || po.payload_hash !== po.approved_payload_hash || !['approved', 'sent', 'acknowledged', 'partially_received'].includes(po.status)) {
      throw new PayOpsError('Only an approved immutable purchase order can be exported.', 'inventory_po_not_exportable', 409);
    }
    const [vendorResult, locationResult] = await Promise.all([
      authed.db.from('os_inventory_vendors').select('name').eq('tenant_id', authed.tenantId).eq('id', po.vendor_id).maybeSingle(),
      authed.db.from('os_inventory_locations').select('name,location_code').eq('tenant_id', authed.tenantId).eq('id', po.ship_to_location_id).maybeSingle(),
    ]);
    if (vendorResult.error) throw vendorResult.error;
    if (locationResult.error) throw locationResult.error;
    const payload = po.payload || {};
    const lineRows = (payload.lines || []).map((line) => `<tr><td>${escapeHtml(line.supplierSku)}</td><td>${escapeHtml(line.packUom)}</td><td>${escapeHtml(line.quantityOrdered)}</td><td>${money(line.unitCostCents)}</td></tr>`).join('');
    const json = escapeHtml(JSON.stringify(payload, null, 2));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(po.order_number)}</title><style>body{font:14px system-ui;margin:32px;color:#17231f}h1{margin-bottom:4px}.meta{color:#4d5f57}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{border:1px solid #cdd8d2;padding:9px;text-align:left}pre{white-space:pre-wrap;font:10px ui-monospace;background:#f4f7f5;padding:12px}.notice{border:2px solid #17231f;padding:12px}@media print{button{display:none}body{margin:16mm}}</style></head><body><button onclick="print()">Save as PDF / Print</button><h1>Purchase order ${escapeHtml(po.order_number)}</h1><p class="meta">Manual human-transmitted order · Supplier: ${escapeHtml(vendorResult.data?.name || '')} · Destination: ${escapeHtml(locationResult.data?.name || '')} (${escapeHtml(locationResult.data?.location_code || '')})</p><div class="notice">Approved payload hash: <strong>${escapeHtml(po.approved_payload_hash)}</strong><br>Substitutions are prohibited. Avalon has not transmitted this document.</div><table><thead><tr><th>Supplier SKU</th><th>Pack</th><th>Quantity</th><th>Unit price</th></tr></thead><tbody>${lineRows}</tbody></table><p>Subtotal ${money(po.subtotal_cents)} · Tax ${money(po.tax_cents)} · Shipping ${money(po.shipping_cents)} · <strong>Maximum total ${money(Number(po.subtotal_cents || 0) + Number(po.tax_cents || 0) + Number(po.shipping_cents || 0))}</strong></p><h2>Immutable JSON evidence</h2><pre>${json}</pre></body></html>`;
    if (req.query?.format === 'json') return res.status(200).json({ html, payloadHash: po.approved_payload_hash, payload });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    return sendConnectedInventoryError(res, error, 'Purchase order document is unavailable.');
  }
}
