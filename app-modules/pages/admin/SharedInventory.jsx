import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, ClipboardList, Gauge, MapPinPlus, PackagePlus, Plus, ShoppingCart, X } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import SharedInventoryWorkspace from '@/components/inventory/SharedInventoryWorkspace';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, authedFetch } from '@/lib/apiClient';

function requestKey(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${suffix}`;
}

const EMPTY_ITEM = { name: '', sku: '', barcode: '', qrCode: '', unit: 'unit', reorderPoint: '0', tags: '' };
const EMPTY_VARIANT = { itemId: '', name: '', sku: '', barcode: '', unitCost: '0' };
const EMPTY_LOT = { itemId: '', variantId: '', lotCode: '', expiresOn: '', receivedAt: '', unitCost: '0' };
const EMPTY_LOCATION = { name: '', locationCode: '', locationType: 'central', nurseProfileId: '' };
const EMPTY_MOVEMENT = { itemId: '', variantId: '', lotId: '', movementType: 'receive', quantity: '1', unitCostCents: '', adjustmentDirection: 'gain' };
const EMPTY_TRANSFER = { itemId: '', variantId: '', lotId: '', toLocationId: '', quantity: '1' };
const EMPTY_PAR = { itemId: '', variantId: '', parQuantity: '0', reorderQuantity: '0', expectedVersion: 0 };
const EMPTY_VENDOR = { name: '' };
const EMPTY_PURCHASE_ORDER = { vendorId: '', orderNumber: '', expectedOn: '', tax: '0', shipping: '0' };
const EMPTY_PURCHASE_ORDER_LINE = { purchaseOrderId: '', itemId: '', variantId: '', quantityOrdered: '1', unitCost: '0' };
const EMPTY_PURCHASE_ORDER_RECEIPT = {
  purchaseOrderId: '',
  purchaseOrderLineId: '',
  expectedPurchaseOrderVersion: 0,
  locationId: '',
  lotId: '',
  quantity: '1',
};
const EMPTY_FULFILLMENT = {
  restockRequestId: '',
  expectedVersion: 0,
  destinationLocationId: '',
  itemId: '',
  variantId: '',
  requestedQuantity: '0',
  sourceKey: '',
  fulfillmentReference: '',
  idempotencyKey: '',
};

function dollarsToCents(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : Number.NaN;
}

function cents(value) {
  try {
    const amount = BigInt(String(value ?? '0'));
    return `$${(amount / BigInt(100)).toLocaleString()}.${String(amount % BigInt(100)).padStart(2, '0')}`;
  } catch { return 'Unavailable'; }
}

function stockKey(locationId, item) {
  return [locationId, item.itemId, item.variantId || '', item.lotId || ''].join('|');
}

function isExpired(date) {
  if (!date) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && time < Date.parse(new Date().toISOString().slice(0, 10));
}

function ActionPanel({ title, children, onClose, onSubmit, submitting, submitLabel }) {
  return (
    <div className="rounded-[1.5rem] border border-foreground/12 bg-foreground/[0.04] p-5" role="region" aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10"><X className="h-4 w-4" /></button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        <button type="submit" disabled={submitting} className="min-h-11 w-full rounded-full bg-foreground px-5 text-[10px] font-bold uppercase tracking-[0.13em] text-background disabled:opacity-45">{submitting ? 'Saving…' : submitLabel}</button>
      </form>
    </div>
  );
}

const inputClass = 'min-h-11 w-full rounded-xl border border-foreground/12 bg-background/65 px-3 text-sm outline-none focus:border-foreground/35';
const INVENTORY_SECTIONS = ['stock', 'kits', 'requests', 'orders', 'suppliers', 'receiving', 'exceptions'];

function ConnectedSummary({ title, description, count, empty }) {
  return <section className="rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.025] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-foreground/50">{description}</p></div><span className="rounded-full border border-foreground/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/50">{count}</span></div>{count === 0 ? <p className="mt-5 rounded-xl border border-dashed border-foreground/12 p-5 text-center text-xs text-foreground/45">{empty}</p> : null}</section>;
}

export default function SharedInventory() {
  const pendingKeys = useRef(new Map());
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('section') || (searchParams.get('view') === 'kits' ? 'kits' : 'stock');
  const activeSection = INVENTORY_SECTIONS.includes(requestedSection) ? requestedSection : 'stock';
  const inventoryView = activeSection === 'kits' ? 'kits' : 'all';
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [panel, setPanel] = useState('');
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT);
  const [lotForm, setLotForm] = useState(EMPTY_LOT);
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
  const [parForm, setParForm] = useState(EMPTY_PAR);
  const [vendorForm, setVendorForm] = useState(EMPTY_VENDOR);
  const [purchaseOrderForm, setPurchaseOrderForm] = useState(EMPTY_PURCHASE_ORDER);
  const [purchaseOrderLineForm, setPurchaseOrderLineForm] = useState(EMPTY_PURCHASE_ORDER_LINE);
  const [purchaseOrderReceiptForm, setPurchaseOrderReceiptForm] = useState(EMPTY_PURCHASE_ORDER_RECEIPT);
  const [fulfillmentForm, setFulfillmentForm] = useState(EMPTY_FULFILLMENT);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionStatus, setActionStatus] = useState('');

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await apiGet('/api/admin/inventory');
      const data = response?.data;
      if (!data || !Array.isArray(data.locations) || !Array.isArray(data.catalog)) {
        throw new Error('Inventory returned an invalid typed-source response.');
      }
      setState({ loading: false, error: '', data: { ...data, runtimeFlags: response?.flags || {} } });
      setSelectedLocationId((current) => {
        const visible = inventoryView === 'kits'
          ? data.locations.filter((row) => row.type === 'nurse_kit')
          : data.locations;
        return current && visible.some((row) => row.id === current) ? current : visible[0]?.id || '';
      });
    } catch (error) {
      setState({ loading: false, error: error.message || 'Inventory is unavailable.', data: null });
    }
  }, [inventoryView]);
  useEffect(() => { load(); }, [load]);

  const post = useCallback(async (payload, prefix) => {
    const key = pendingKeys.current.get(prefix) || requestKey(prefix);
    pendingKeys.current.set(prefix, key);
    return authedFetch('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(payload),
    });
  }, []);

  const submit = useCallback(async (event, payload, prefix, reset) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError('');
    setActionStatus('');
    try {
      await post(payload, prefix);
      pendingKeys.current.delete(prefix);
      reset();
      setPanel('');
      await load();
      setActionStatus('Inventory updated from the typed stock ledger.');
    } catch (error) {
      setActionError(error.message || 'The inventory change could not be saved.');
    } finally {
      setSubmitting(false);
    }
  }, [load, post]);

  const data = state.data;
  const connected = data?.connected || null;
  const selectedLocation = data?.locations?.find((row) => row.id === selectedLocationId) || null;
  const items = selectedLocation?.items || [];
  const transferItem = items.find((item) => item.itemId === transferForm.itemId && (item.variantId || '') === transferForm.variantId && (item.lotId || '') === transferForm.lotId) || null;
  const locationOptions = data?.locations || [];
  const workspaceLocations = inventoryView === 'kits'
    ? locationOptions.filter((location) => location.type === 'nurse_kit')
    : locationOptions;

  const movementItemOptions = useMemo(() => data?.catalog || [], [data]);
  const movementVariantOptions = useMemo(() => (data?.variants || []).filter((row) => row.itemId === movementForm.itemId), [data, movementForm.itemId]);
  const movementLotOptions = useMemo(() => (data?.lots || []).filter((row) => row.itemId === movementForm.itemId && (!movementForm.variantId || row.variantId === movementForm.variantId)), [data, movementForm.itemId, movementForm.variantId]);
  const lotVariantOptions = useMemo(() => (data?.variants || []).filter((row) => row.itemId === lotForm.itemId), [data, lotForm.itemId]);
  const purchaseOrderLineVariantOptions = useMemo(() => (data?.variants || []).filter((row) => row.itemId === purchaseOrderLineForm.itemId), [data, purchaseOrderLineForm.itemId]);
  const purchaseOrderReceiptLine = useMemo(() => {
    const order = (data?.purchaseOrders || []).find((row) => row.id === purchaseOrderReceiptForm.purchaseOrderId);
    return (order?.lines || []).find((row) => row.id === purchaseOrderReceiptForm.purchaseOrderLineId) || null;
  }, [data, purchaseOrderReceiptForm.purchaseOrderId, purchaseOrderReceiptForm.purchaseOrderLineId]);
  const purchaseOrderReceiptLots = useMemo(() => (data?.lots || []).filter((lot) => (
    purchaseOrderReceiptLine
    && lot.itemId === purchaseOrderReceiptLine.itemId
    && (lot.variantId || '') === (purchaseOrderReceiptLine.variantId || '')
    && Number(lot.unitCostCents || 0) === Number(purchaseOrderReceiptLine.unitCostCents || 0)
    && Number(lot.unitCostCents || 0) > 0
  )), [data, purchaseOrderReceiptLine]);
  const purchaseOrderReceiptLocations = useMemo(() => locationOptions.filter((location) => (
    location.status === 'active' && ['central', 'warehouse', 'quarantine'].includes(location.type)
  )), [locationOptions]);
  const fulfillmentSourceOptions = useMemo(() => locationOptions.flatMap((location) => (
    (location.items || []).map((item) => ({ location, item, key: stockKey(location.id, item) }))
  )).filter(({ location, item }) => (
    location.id !== fulfillmentForm.destinationLocationId
    && location.status === 'active'
    && item.itemId === fulfillmentForm.itemId
    && (item.variantId || '') === fulfillmentForm.variantId
    && !isExpired(item.expiresOn)
    && Number(item.quantityOnHand || 0) >= Number(fulfillmentForm.requestedQuantity || 0)
  )), [fulfillmentForm.destinationLocationId, fulfillmentForm.itemId, fulfillmentForm.requestedQuantity, fulfillmentForm.variantId, locationOptions]);
  const openMovement = (item = null) => {
    setMovementForm({
      ...EMPTY_MOVEMENT,
      itemId: item?.itemId || '',
      variantId: item?.variantId || '',
      lotId: item?.lotId || '',
      unitCostCents: item?.unitCostCents ? String(Number(item.unitCostCents) / 100) : '',
    });
    setActionError('');
    setPanel('movement');
  };
  const openTransfer = (item) => {
    setTransferForm({
      ...EMPTY_TRANSFER,
      itemId: item?.itemId || '',
      variantId: item?.variantId || '',
      lotId: item?.lotId || '',
    });
    setActionError('');
    setActionStatus('');
    setPanel('transfer');
  };
  const openPar = (item) => {
    setParForm({
      itemId: item?.itemId || '',
      variantId: item?.variantId || '',
      parQuantity: item?.parQuantity || '0',
      reorderQuantity: item?.reorderQuantity || '0',
      expectedVersion: Number(item?.parVersion || 0),
    });
    setActionError('');
    setActionStatus('');
    setPanel('par');
  };
  const openFulfillment = (request) => {
    const lines = request.lines || [];
    if (lines.length !== 1) {
      setActionError('This request needs administrator review because it does not contain exactly one stock line.');
      return;
    }
    const line = lines[0];
    const sources = locationOptions.flatMap((location) => (
      (location.items || []).map((item) => ({ location, item, key: stockKey(location.id, item) }))
    )).filter(({ location, item }) => (
      location.id !== request.locationId
      && location.status === 'active'
      && item.itemId === line.itemId
      && (item.variantId || '') === (line.variantId || '')
      && !isExpired(item.expiresOn)
      && Number(item.quantityOnHand || 0) >= Number(line.requestedQuantity || 0)
    ));
    setFulfillmentForm({
      restockRequestId: request.id,
      expectedVersion: Number(request.version),
      destinationLocationId: request.locationId,
      itemId: line.itemId,
      variantId: line.variantId || '',
      requestedQuantity: line.requestedQuantity,
      sourceKey: sources[0]?.key || '',
      fulfillmentReference: '',
      idempotencyKey: requestKey(`inventory-restock-${request.id}-fulfill`),
    });
    setActionError('');
    setActionStatus('');
    setPanel('fulfillment');
  };
  const openPurchaseOrderLine = (order) => {
    setPurchaseOrderLineForm({ ...EMPTY_PURCHASE_ORDER_LINE, purchaseOrderId: order.id });
    setActionError('');
    setActionStatus('');
    setPanel('purchase-order-line');
  };
  const openPurchaseOrderReceipt = (order, line) => {
    const outstanding = Math.max(0, Number(line.quantityOrdered || 0) - Number(line.quantityReceived || 0));
    const connectedOrder = connectedOrderFor(order.id);
    setPurchaseOrderReceiptForm({
      purchaseOrderId: order.id,
      purchaseOrderLineId: line.id,
      expectedPurchaseOrderVersion: Number(order.version),
      locationId: connectedOrder?.ship_to_location_id || purchaseOrderReceiptLocations[0]?.id || '',
      lotId: '',
      quantity: String(outstanding),
    });
    setActionError('');
    setActionStatus('');
    setPanel('purchase-order-receipt');
  };

  const fulfillRestock = async (event) => {
    event.preventDefault();
    const source = fulfillmentSourceOptions.find((row) => row.key === fulfillmentForm.sourceKey);
    if (!source) {
      setActionError('Choose a source stock line with enough on-hand quantity.');
      return;
    }
    setSubmitting(true);
    setActionError('');
    setActionStatus('');
    try {
      const response = await authedFetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Idempotency-Key': fulfillmentForm.idempotencyKey },
        body: JSON.stringify({
          action: 'fulfill_restock',
          restockRequestId: fulfillmentForm.restockRequestId,
          expectedVersion: fulfillmentForm.expectedVersion,
          fromLocationId: source.location.id,
          lotId: source.item.lotId || null,
          fulfillmentReference: fulfillmentForm.fulfillmentReference,
        }),
      });
      const record = response?.result?.record;
      if (response?.ok !== true || (connected ? record?.status !== 'in_transit' : !record?.fulfillmentTransferGroupId)) {
        throw new Error('Inventory did not confirm the protected restock lifecycle.');
      }
      setFulfillmentForm(EMPTY_FULFILLMENT);
      setPanel('');
      await load();
      setActionStatus(connected
        ? 'Stock moved into transit. The nurse must inspect and accept the handoff before the kit and request are credited.'
        : 'Stock transferred into the nurse kit and the restock request was fulfilled.');
    } catch (error) {
      setActionError(error.message || 'The restock could not be fulfilled. Retry uses the same protected request identifiers.');
    } finally {
      setSubmitting(false);
    }
  };

  const receivePurchaseOrder = async (event) => {
    if (!connected) {
      return submit(event, { action: 'receive_purchase_order_line', ...purchaseOrderReceiptForm },
        `inventory-purchase-order-receipt-${purchaseOrderReceiptForm.purchaseOrderLineId}`,
        () => setPurchaseOrderReceiptForm(EMPTY_PURCHASE_ORDER_RECEIPT));
    }
    event.preventDefault(); setSubmitting(true); setActionError(''); setActionStatus('');
    try {
      await authedFetch('/api/admin/inventory/receiving', {
        method: 'POST', headers: { 'Idempotency-Key': requestKey(`inventory-inspection-${purchaseOrderReceiptForm.purchaseOrderLineId}`) },
        body: JSON.stringify({ action: 'create_inspection', purchaseOrderId: purchaseOrderReceiptForm.purchaseOrderId,
          locationId: purchaseOrderReceiptForm.locationId, conditionCode: 'RECEIVED_OK', temperatureEvidence: {},
          lines: [{ purchaseOrderLineId: purchaseOrderReceiptForm.purchaseOrderLineId,
            lotId: purchaseOrderReceiptForm.lotId, quantityReceived: purchaseOrderReceiptForm.quantity,
            quantityAccepted: purchaseOrderReceiptForm.quantity, disposition: 'accepted', evidence: {} }] }),
      });
      setPurchaseOrderReceiptForm(EMPTY_PURCHASE_ORDER_RECEIPT); setPanel(''); await load();
      setActionStatus('Receiving inspection saved. Post it separately after review to create ledger stock.');
    } catch (error) { setActionError(error.message || 'The receiving inspection could not be saved.'); }
    finally { setSubmitting(false); }
  };

  const postInspection = useCallback(async (inspection) => {
    setSubmitting(true); setActionError(''); setActionStatus('');
    try {
      await authedFetch('/api/admin/inventory/receiving', {
        method: 'POST', headers: { 'Idempotency-Key': requestKey(`inventory-inspection-${inspection.id}-post`) },
        body: JSON.stringify({ action: 'post_inspection', inspectionId: inspection.id, expectedVersion: inspection.version }),
      });
      await load(); setActionStatus('Inspection posted to the append-only stock ledger. Vendor AP can reference the committed PO and receipt evidence.');
    } catch (error) { setActionError(error.message || 'The inspection could not be posted.'); }
    finally { setSubmitting(false); }
  }, [load]);

  const transitionRestock = async (request, nextStatus) => {
    setSubmitting(true);
    setActionError('');
    setActionStatus('');
    try {
      await post({
        action: 'transition_restock',
        restockRequestId: request.id,
        expectedVersion: request.version,
        nextStatus,
      }, `inventory-restock-${request.id}-${nextStatus}`);
      pendingKeys.current.delete(`inventory-restock-${request.id}-${nextStatus}`);
      await load();
      setActionStatus(`Restock request moved to ${nextStatus.replaceAll('_', ' ')}.`);
    } catch (error) {
      setActionError(error.message || 'The restock request could not be updated.');
    } finally {
      setSubmitting(false);
    }
  };

  const connectedOrderFor = useCallback((orderId) => (connected?.purchaseOrders || [])
    .find((order) => order.id === orderId), [connected]);

  const updateConnectedOrder = useCallback(async (order, action, extra = {}) => {
    const current = connectedOrderFor(order.id);
    if (!current) { setActionError('Refresh to load the connected purchase-order version.'); return; }
    setSubmitting(true); setActionError(''); setActionStatus('');
    try {
      await authedFetch('/api/admin/inventory/purchase-orders', {
        method: 'POST', headers: { 'Idempotency-Key': requestKey(`inventory-po-${order.id}-${action}`) },
        body: JSON.stringify({ action, purchaseOrderId: order.id, expectedVersion: current.version, ...extra }),
      });
      await load();
      setActionStatus(action === 'submit' ? 'Purchase order frozen and submitted for independent Procurement approval.'
        : action === 'approve' ? 'Exact purchase-order payload approved. Any commercial change now requires a new draft.'
          : 'Manual supplier evidence recorded. Avalon did not contact the supplier.');
    } catch (error) { setActionError(error.message || 'The purchase order action could not be recorded.'); }
    finally { setSubmitting(false); }
  }, [connectedOrderFor, load]);

  const exportConnectedOrder = useCallback(async (order) => {
    const current = connectedOrderFor(order.id);
    if (!current) { setActionError('Refresh to load the connected purchase-order version.'); return; }
    const preview = window.open('about:blank', '_blank');
    if (preview) preview.opener = null;
    setSubmitting(true); setActionError(''); setActionStatus('');
    try {
      const document = await apiGet(`/api/admin/inventory/purchase-order-document?id=${encodeURIComponent(order.id)}&format=json`);
      await authedFetch('/api/admin/inventory/purchase-orders', {
        method: 'POST', headers: { 'Idempotency-Key': requestKey(`inventory-po-${order.id}-manual-exported`) },
        body: JSON.stringify({ action: 'record_event', purchaseOrderId: order.id, expectedVersion: current.version,
          eventType: 'manual_exported', evidence: { documentPayloadHash: document.payloadHash, deliveryMode: 'HUMAN_MANUAL' } }),
      });
      const url = URL.createObjectURL(new Blob([document.html], { type: 'text/html' }));
      if (preview) preview.location = url; else window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      await load();
      setActionStatus('Immutable order document opened for a human to save or print. Avalon did not transmit it.');
    } catch (error) { if (preview) preview.close(); setActionError(error.message || 'The manual order document could not be prepared.'); }
    finally { setSubmitting(false); }
  }, [connectedOrderFor, load]);

  const recordConnectedOrderEvent = useCallback(async (order, eventType) => {
    const reference = window.prompt(`External reference for ${eventType.replaceAll('_', ' ')} (leave blank only if unavailable):`, '') ?? null;
    if (reference === null) return;
    const evidenceReference = window.prompt('Non-PHI evidence reference (document ID, tracking ID, or coded note):', '') ?? null;
    if (evidenceReference === null) return;
    await updateConnectedOrder(order, 'record_event', {
      eventType, externalOrderId: reference || null,
      evidence: { evidenceReference: evidenceReference || 'NOT_AVAILABLE', recordedFrom: 'HUMAN_MANUAL' },
    });
  }, [updateConnectedOrder]);

  return (
    <AdminShell title="Inventory">
      {!data && !state.loading ? (
        <OperationalSourceUnavailable
          title="Typed inventory unavailable"
          description="The legacy browser inventory is not used as operational or finance truth. Apply the shared inventory migrations before enabling this workspace."
        />
      ) : (
        <div className="space-y-5">
          {actionError && <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-3 text-sm text-red-700">{actionError}</div>}
          {actionStatus && <div role="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-sm text-emerald-800">{actionStatus}</div>}

          <nav aria-label="Inventory sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.025] p-2">
            {INVENTORY_SECTIONS.map((section) => <button key={section} type="button" aria-current={activeSection === section ? 'page' : undefined} onClick={() => setSearchParams({ section })} className={`min-h-10 shrink-0 rounded-xl px-4 text-[10px] font-bold uppercase tracking-[0.12em] ${activeSection === section ? 'bg-foreground text-background' : 'text-foreground/55 hover:bg-foreground/[0.05]'}`}>{section}</button>)}
          </nav>

          {!connected && <div role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-800">Connected workflows are disabled. Existing typed stock remains readable; custody, inspections, manual procurement, and A1 stay blocked until migrations and server flags are verified.</div>}
          {connected && <div role="status" className="rounded-2xl border border-foreground/10 bg-foreground/[0.025] px-4 py-3 text-xs text-foreground/55">Manual procurement: {data?.runtimeFlags?.manualProcurement ? 'enabled for this server' : 'off'} · A1 drafts: {data?.runtimeFlags?.a1Drafts ? 'enabled' : 'off'} · Supplier execution: off · Kill switch: {data?.runtimeFlags?.inventoryKillSwitch ? 'active' : 'released'}</div>}

          {panel === 'item' && (
            <ActionPanel title="Add inventory item" onClose={() => setPanel('')} submitting={submitting} submitLabel="Add item" onSubmit={(event) => submit(event, { action: 'create_item', ...itemForm, tags: itemForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }, 'inventory-item', () => setItemForm(EMPTY_ITEM))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Name<input required value={itemForm.name} onChange={(event) => setItemForm((row) => ({ ...row, name: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">SKU<input value={itemForm.sku} onChange={(event) => setItemForm((row) => ({ ...row, sku: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Barcode<input value={itemForm.barcode} onChange={(event) => setItemForm((row) => ({ ...row, barcode: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">QR code<input value={itemForm.qrCode} onChange={(event) => setItemForm((row) => ({ ...row, qrCode: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Unit<input required value={itemForm.unit} onChange={(event) => setItemForm((row) => ({ ...row, unit: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Reorder point<input type="number" min="0" step="0.001" value={itemForm.reorderPoint} onChange={(event) => setItemForm((row) => ({ ...row, reorderPoint: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60 sm:col-span-2">Tags<input value={itemForm.tags} onChange={(event) => setItemForm((row) => ({ ...row, tags: event.target.value }))} className={`${inputClass} mt-1.5`} placeholder="IV supplies, cold chain, event kit" /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'variant' && (
            <ActionPanel title="Add item variant" onClose={() => setPanel('')} submitting={submitting} submitLabel="Add variant" onSubmit={(event) => submit(event, { action: 'create_variant', ...variantForm, unitCostCents: dollarsToCents(variantForm.unitCost) }, 'inventory-variant', () => setVariantForm(EMPTY_VARIANT))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Item<select required value={variantForm.itemId} onChange={(event) => setVariantForm((row) => ({ ...row, itemId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Choose item</option>{movementItemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Variant name<input required value={variantForm.name} onChange={(event) => setVariantForm((row) => ({ ...row, name: event.target.value }))} className={`${inputClass} mt-1.5`} placeholder="500 mL" /></label>
                <label className="text-xs font-semibold text-foreground/60">SKU<input value={variantForm.sku} onChange={(event) => setVariantForm((row) => ({ ...row, sku: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Barcode<input value={variantForm.barcode} onChange={(event) => setVariantForm((row) => ({ ...row, barcode: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Default unit cost ($)<input required type="number" min="0" step="0.01" value={variantForm.unitCost} onChange={(event) => setVariantForm((row) => ({ ...row, unitCost: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'lot' && (
            <ActionPanel title="Add lot or batch" onClose={() => setPanel('')} submitting={submitting} submitLabel="Add lot" onSubmit={(event) => submit(event, { action: 'create_lot', ...lotForm, variantId: lotForm.variantId || null, expiresOn: lotForm.expiresOn || null, receivedAt: lotForm.receivedAt || null, unitCostCents: dollarsToCents(lotForm.unitCost) }, 'inventory-lot', () => setLotForm(EMPTY_LOT))}>
              <p className="text-xs leading-relaxed text-foreground/50">Lot and expiry stay attached to every later receive, use, transfer, and cost event.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Item<select required value={lotForm.itemId} onChange={(event) => setLotForm((row) => ({ ...row, itemId: event.target.value, variantId: '' }))} className={`${inputClass} mt-1.5`}><option value="">Choose item</option>{movementItemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Variant<select value={lotForm.variantId} onChange={(event) => setLotForm((row) => ({ ...row, variantId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Base item</option>{lotVariantOptions.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Lot / batch code<input required value={lotForm.lotCode} onChange={(event) => setLotForm((row) => ({ ...row, lotCode: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Expires on<input type="date" value={lotForm.expiresOn} onChange={(event) => setLotForm((row) => ({ ...row, expiresOn: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Received at<input type="datetime-local" value={lotForm.receivedAt} onChange={(event) => setLotForm((row) => ({ ...row, receivedAt: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Unit cost ($)<input required type="number" min="0" step="0.01" value={lotForm.unitCost} onChange={(event) => setLotForm((row) => ({ ...row, unitCost: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'location' && (
            <ActionPanel title="Add inventory location" onClose={() => setPanel('')} submitting={submitting} submitLabel="Add location" onSubmit={(event) => submit(event, { action: 'create_location', ...locationForm }, 'inventory-location', () => setLocationForm(EMPTY_LOCATION))}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Name<input required value={locationForm.name} onChange={(event) => setLocationForm((row) => ({ ...row, name: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Code<input required value={locationForm.locationCode} onChange={(event) => setLocationForm((row) => ({ ...row, locationCode: event.target.value.toUpperCase() }))} className={`${inputClass} mt-1.5`} placeholder="SF-CENTRAL" /></label>
                <label className="text-xs font-semibold text-foreground/60">Type<select value={locationForm.locationType} onChange={(event) => setLocationForm((row) => ({ ...row, locationType: event.target.value, nurseProfileId: '' }))} className={`${inputClass} mt-1.5`}><option value="central">Central</option><option value="warehouse">Warehouse</option><option value="nurse_kit">Nurse kit</option><option value="event_kit">Event kit</option><option value="vehicle">Vehicle</option><option value="quarantine">Quarantine</option></select></label>
                {locationForm.locationType === 'nurse_kit' && <label className="text-xs font-semibold text-foreground/60">Assigned nurse<select required value={locationForm.nurseProfileId} onChange={(event) => setLocationForm((row) => ({ ...row, nurseProfileId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Choose nurse</option>{(data?.nurses || []).map((nurse) => <option key={nurse.profileId} value={nurse.profileId}>{nurse.displayName}</option>)}</select></label>}
              </div>
            </ActionPanel>
          )}

          {panel === 'movement' && (
            <ActionPanel title="Record stock movement" onClose={() => setPanel('')} submitting={submitting} submitLabel="Record movement" onSubmit={(event) => submit(event, { action: 'record_movement', locationId: selectedLocationId, ...movementForm, unitCostCents: movementForm.unitCostCents === '' ? null : Math.round(Number(movementForm.unitCostCents) * 100), reasonCode: 'ADMIN_REVIEWED' }, 'inventory-movement', () => setMovementForm(EMPTY_MOVEMENT))}>
              {!selectedLocationId && <p className="text-sm text-amber-700">Create and select a location first.</p>}
              <p className="text-xs leading-relaxed text-foreground/50">Use PO receiving when stock came from a purchase order. Any costed movement must use a matching lot; no-lot stock remains explicitly uncosted in Finance.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Item<select required value={movementForm.itemId} onChange={(event) => setMovementForm((row) => ({ ...row, itemId: event.target.value, variantId: '', lotId: '' }))} className={`${inputClass} mt-1.5`}><option value="">Choose item</option>{movementItemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` · ${item.sku}` : ''}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Movement<select value={movementForm.movementType} onChange={(event) => setMovementForm((row) => ({ ...row, movementType: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="receive">Receive</option><option value="consume">Consume</option><option value="adjust">Count adjustment</option><option value="expire">Expire</option><option value="shrink">Shrink / loss</option><option value="return">Return to vendor</option></select></label>
                {movementVariantOptions.length > 0 && <label className="text-xs font-semibold text-foreground/60">Variant<select value={movementForm.variantId} onChange={(event) => setMovementForm((row) => ({ ...row, variantId: event.target.value, lotId: '' }))} className={`${inputClass} mt-1.5`}><option value="">Base item</option>{movementVariantOptions.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}{variant.sku ? ` · ${variant.sku}` : ''}</option>)}</select></label>}
                {movementLotOptions.length > 0 && <label className="text-xs font-semibold text-foreground/60">Lot / batch<select value={movementForm.lotId} onChange={(event) => { const lot = movementLotOptions.find((row) => row.id === event.target.value); setMovementForm((row) => ({ ...row, lotId: event.target.value, variantId: lot?.variantId || row.variantId })); }} className={`${inputClass} mt-1.5`}><option value="">No lot</option>{movementLotOptions.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotCode || 'Uncoded lot'}{lot.expiresOn ? ` · Exp ${lot.expiresOn}` : ''}</option>)}</select></label>}
                {movementForm.movementType === 'adjust' && <label className="text-xs font-semibold text-foreground/60">Direction<select value={movementForm.adjustmentDirection} onChange={(event) => setMovementForm((row) => ({ ...row, adjustmentDirection: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="gain">Increase</option><option value="loss">Decrease</option></select></label>}
                <label className="text-xs font-semibold text-foreground/60">Quantity<input required type="number" min="0.001" step="0.001" value={movementForm.quantity} onChange={(event) => setMovementForm((row) => ({ ...row, quantity: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Unit cost ($)<input type="number" min="0" step="0.01" value={movementForm.unitCostCents} onChange={(event) => setMovementForm((row) => ({ ...row, unitCostCents: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'transfer' && (
            <ActionPanel title="Transfer stock" onClose={() => setPanel('')} submitting={submitting} submitLabel="Transfer stock" onSubmit={(event) => submit(event, { action: 'transfer', fromLocationId: selectedLocationId, ...transferForm, variantId: transferForm.variantId || null, lotId: transferForm.lotId || null }, 'inventory-transfer', () => setTransferForm(EMPTY_TRANSFER))}>
              <p className="text-xs leading-relaxed text-foreground/50">Moves stock atomically out of <span className="font-semibold text-foreground/70">{selectedLocation?.name}</span> and into the destination. A partial transfer cannot be recorded.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Item<input readOnly value={transferItem?.name || 'Inventory item'} className={`${inputClass} mt-1.5 opacity-70`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Destination<select required value={transferForm.toLocationId} onChange={(event) => setTransferForm((row) => ({ ...row, toLocationId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Choose location</option>{locationOptions.filter((location) => location.id !== selectedLocationId && location.status === 'active' && (!isExpired(transferItem?.expiresOn) || location.type === 'quarantine')).map((location) => <option key={location.id} value={location.id}>{location.name} · {location.code}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Quantity<input required type="number" min="0.001" step="0.001" value={transferForm.quantity} onChange={(event) => setTransferForm((row) => ({ ...row, quantity: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'par' && (
            <ActionPanel title="Set location par" onClose={() => setPanel('')} submitting={submitting} submitLabel="Save par level" onSubmit={(event) => submit(event, { action: 'set_par', locationId: selectedLocationId, ...parForm, variantId: parForm.variantId || null }, 'inventory-par', () => setParForm(EMPTY_PAR))}>
              <p className="text-xs leading-relaxed text-foreground/50">Par levels apply to <span className="font-semibold text-foreground/70">{selectedLocation?.name}</span>. Nurses see the target and restock threshold, never cost or global inventory.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Par target<input required type="number" min="0" step="0.001" value={parForm.parQuantity} onChange={(event) => setParForm((row) => ({ ...row, parQuantity: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Restock at<input required type="number" min="0" step="0.001" value={parForm.reorderQuantity} onChange={(event) => setParForm((row) => ({ ...row, reorderQuantity: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'vendor' && (
            <ActionPanel title="Add vendor" onClose={() => setPanel('')} submitting={submitting} submitLabel="Add vendor" onSubmit={(event) => submit(event, { action: 'create_vendor', ...vendorForm }, 'inventory-vendor', () => setVendorForm(EMPTY_VENDOR))}>
              <label className="text-xs font-semibold text-foreground/60">Vendor name<input required value={vendorForm.name} onChange={(event) => setVendorForm({ name: event.target.value })} className={`${inputClass} mt-1.5`} /></label>
              <p className="text-xs leading-relaxed text-foreground/45">Vendor contact and payment instructions stay outside this PHI-free inventory record until a controlled procurement workflow is enabled.</p>
            </ActionPanel>
          )}

          {panel === 'purchase-order' && (
            <ActionPanel title="Draft purchase order" onClose={() => setPanel('')} submitting={submitting} submitLabel="Save draft PO" onSubmit={(event) => submit(event, { action: 'create_purchase_order', vendorId: purchaseOrderForm.vendorId || null, orderNumber: purchaseOrderForm.orderNumber, expectedOn: purchaseOrderForm.expectedOn || null, subtotalCents: 0, taxCents: dollarsToCents(purchaseOrderForm.tax), shippingCents: dollarsToCents(purchaseOrderForm.shipping) }, 'inventory-purchase-order', () => setPurchaseOrderForm(EMPTY_PURCHASE_ORDER))}>
              <p className="text-xs leading-relaxed text-foreground/50">This records a draft commitment for inventory planning. Its subtotal is calculated from controlled PO lines; it does not authorize a purchase or move money.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">PO number<input required value={purchaseOrderForm.orderNumber} onChange={(event) => setPurchaseOrderForm((row) => ({ ...row, orderNumber: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Vendor<select value={purchaseOrderForm.vendorId} onChange={(event) => setPurchaseOrderForm((row) => ({ ...row, vendorId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">No vendor selected</option>{(data?.vendors || []).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Expected date<input type="date" value={purchaseOrderForm.expectedOn} onChange={(event) => setPurchaseOrderForm((row) => ({ ...row, expectedOn: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Tax ($)<input required type="number" min="0" step="0.01" value={purchaseOrderForm.tax} onChange={(event) => setPurchaseOrderForm((row) => ({ ...row, tax: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Shipping ($)<input required type="number" min="0" step="0.01" value={purchaseOrderForm.shipping} onChange={(event) => setPurchaseOrderForm((row) => ({ ...row, shipping: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'purchase-order-line' && (
            <ActionPanel title="Add purchase order line" onClose={() => setPanel('')} submitting={submitting} submitLabel="Add PO line" onSubmit={(event) => submit(event, {
              action: 'create_purchase_order_line',
              ...purchaseOrderLineForm,
              variantId: purchaseOrderLineForm.variantId || null,
              unitCostCents: dollarsToCents(purchaseOrderLineForm.unitCost),
            }, `inventory-purchase-order-line-${purchaseOrderLineForm.purchaseOrderId}`, () => setPurchaseOrderLineForm(EMPTY_PURCHASE_ORDER_LINE))}>
              <p className="text-xs leading-relaxed text-foreground/50">The ordered quantity and exact unit cost become the receipt control. Add or select a matching lot before receiving it.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Item<select required value={purchaseOrderLineForm.itemId} onChange={(event) => setPurchaseOrderLineForm((row) => ({ ...row, itemId: event.target.value, variantId: '' }))} className={`${inputClass} mt-1.5`}><option value="">Choose item</option>{movementItemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Variant<select value={purchaseOrderLineForm.variantId} onChange={(event) => setPurchaseOrderLineForm((row) => ({ ...row, variantId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Base item</option>{purchaseOrderLineVariantOptions.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Quantity ordered<input required type="number" min="0.001" step="0.001" value={purchaseOrderLineForm.quantityOrdered} onChange={(event) => setPurchaseOrderLineForm((row) => ({ ...row, quantityOrdered: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Unit cost ($)<input required type="number" min="0.01" step="0.01" value={purchaseOrderLineForm.unitCost} onChange={(event) => setPurchaseOrderLineForm((row) => ({ ...row, unitCost: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
            </ActionPanel>
          )}

          {panel === 'purchase-order-receipt' && (
            <ActionPanel title={connected ? 'Create receiving inspection' : 'Receive purchase order stock'} onClose={() => setPanel('')} submitting={submitting} submitLabel={connected ? 'Save inspection' : 'Receive into stock'} onSubmit={receivePurchaseOrder}>
              <p className="text-xs leading-relaxed text-foreground/50">{connected ? 'This records reviewed receipt evidence first. Stock is created only when the versioned inspection is posted from Receiving.' : 'Receipt is atomic: the PO line, lot cost, location balance, PO status, and Finance source reference update together.'}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-foreground/60">Item<input readOnly value={purchaseOrderReceiptLine ? `${purchaseOrderReceiptLine.itemName}${purchaseOrderReceiptLine.variantName ? ` · ${purchaseOrderReceiptLine.variantName}` : ''}` : 'Purchase order item'} className={`${inputClass} mt-1.5 opacity-70`} /></label>
                <label className="text-xs font-semibold text-foreground/60">Receive at<select required value={purchaseOrderReceiptForm.locationId} onChange={(event) => setPurchaseOrderReceiptForm((row) => ({ ...row, locationId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Choose central location</option>{purchaseOrderReceiptLocations.map((location) => <option key={location.id} value={location.id}>{location.name} · {location.code}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Matching lot<select required value={purchaseOrderReceiptForm.lotId} onChange={(event) => setPurchaseOrderReceiptForm((row) => ({ ...row, lotId: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Choose exact-cost lot</option>{purchaseOrderReceiptLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotCode || 'Uncoded lot'} · {cents(lot.unitCostCents)}{lot.expiresOn ? ` · Exp ${lot.expiresOn}` : ''}</option>)}</select></label>
                <label className="text-xs font-semibold text-foreground/60">Quantity received<input required type="number" min="0.001" step="0.001" max={purchaseOrderReceiptLine ? String(Math.max(0, Number(purchaseOrderReceiptLine.quantityOrdered || 0) - Number(purchaseOrderReceiptLine.quantityReceived || 0))) : undefined} value={purchaseOrderReceiptForm.quantity} onChange={(event) => setPurchaseOrderReceiptForm((row) => ({ ...row, quantity: event.target.value }))} className={`${inputClass} mt-1.5`} /></label>
              </div>
              {!purchaseOrderReceiptLots.length && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-800">Create a lot for this exact item, variant, and PO unit cost before receiving stock.</p>}
            </ActionPanel>
          )}

          {panel === 'fulfillment' && (
            <ActionPanel title="Transfer and fulfill restock" onClose={() => setPanel('')} submitting={submitting} submitLabel="Transfer + fulfill" onSubmit={fulfillRestock}>
              <p className="text-xs leading-relaxed text-foreground/50">This transfers the requested quantity from one exact stock line into the assigned nurse kit, then closes the request with the same protected retry identifiers.</p>
              <label className="text-xs font-semibold text-foreground/60">Source stock<select required value={fulfillmentForm.sourceKey} onChange={(event) => setFulfillmentForm((row) => ({ ...row, sourceKey: event.target.value }))} className={`${inputClass} mt-1.5`}><option value="">Choose available stock</option>{fulfillmentSourceOptions.map(({ key, location, item }) => <option key={key} value={key}>{location.name} · {item.name}{item.lotCode ? ` · Lot ${item.lotCode}` : ''} · {item.quantityOnHand} available</option>)}</select></label>
              {!fulfillmentSourceOptions.length && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-800">No matching source line has enough stock. Receive inventory or correct the source count before fulfillment.</p>}
              <label className="text-xs font-semibold text-foreground/60">Fulfillment reference<input required maxLength={160} pattern="[A-Za-z0-9][A-Za-z0-9._:/#-]{0,159}" value={fulfillmentForm.fulfillmentReference} onChange={(event) => setFulfillmentForm((row) => ({ ...row, fulfillmentReference: event.target.value }))} className={`${inputClass} mt-1.5`} placeholder="KIT-HANDOFF-2026-001" /></label>
            </ActionPanel>
          )}

          {(activeSection === 'stock' || activeSection === 'kits') && <SharedInventoryWorkspace
            mode="admin"
            title={inventoryView === 'kits' ? 'Nurse Kits' : 'Inventory'}
            subtitle={inventoryView === 'kits' ? 'Manage assigned nurse kits, custody, par levels, lot-aware transfers, expiry, and restock from the same controlled inventory source.' : 'Sortly-style stock control for central inventory, nurse kits, event packs, lots, expiry, restock, and custody—backed by one append-only typed source.'}
            locations={workspaceLocations}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocationId}
            items={items}
            loading={state.loading}
            onRefresh={load}
            onAdjust={openMovement}
            onTransfer={openTransfer}
            onSetPar={openPar}
            sourceMessage="Finance costs are derived only from reviewed typed stock movements. The old browser-written item and price tables are not accepted as accounting evidence."
            headerActions={(
              <>
                <button type="button" onClick={() => { setPanel('item'); setActionError(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-background"><PackagePlus className="h-3.5 w-3.5" /> Add item</button>
                <button type="button" onClick={() => { setPanel('variant'); setActionError(''); }} disabled={!(data?.catalog || []).length} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-35"><PackagePlus className="h-3.5 w-3.5" /> Variant</button>
                <button type="button" onClick={() => { setPanel('lot'); setActionError(''); }} disabled={!(data?.catalog || []).length} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-35"><PackagePlus className="h-3.5 w-3.5" /> Lot</button>
                <button type="button" onClick={() => { setPanel('location'); setActionError(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><MapPinPlus className="h-3.5 w-3.5" /> Add location</button>
                <button type="button" onClick={() => openMovement()} disabled={!selectedLocationId || !(data?.catalog || []).length} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-35"><Plus className="h-3.5 w-3.5" /> Stock</button>
                <button type="button" onClick={() => { setPanel('vendor'); setActionError(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><Building2 className="h-3.5 w-3.5" /> Vendor</button>
                <button type="button" onClick={() => { setPanel('purchase-order'); setActionError(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em]"><ShoppingCart className="h-3.5 w-3.5" /> Draft PO</button>
              </>
            )}
          />}

          {activeSection === 'suppliers' && <ConnectedSummary title="Supplier catalog" description="Approved supplier SKUs, pack conversions, price validity, and substitution policy. No supplier connection is configured." count={connected?.supplierItems?.length || 0} empty="No supplier catalog has been approved. Procurement remains fail-closed." />}
          {activeSection === 'receiving' && <section className="rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.025] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Receiving inspections</h2><p className="mt-1 text-xs leading-relaxed text-foreground/50">Only manually sent, immutable POs can be inspected. Posting is a separate version-checked ledger action.</p></div><span className="rounded-full border border-foreground/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/50">{connected?.inspections?.length || 0}</span></div><div className="mt-4 grid gap-2">{(connected?.inspections || []).map((inspection) => <div key={inspection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-background/55 p-3"><div><p className="text-xs font-semibold">Inspection {inspection.id.slice(0, 8)}</p><p className="mt-1 text-[10px] text-foreground/45">{inspection.condition_code || 'Condition pending'} · {inspection.status}</p></div>{['accepted', 'partial', 'quarantined'].includes(inspection.status) ? <button type="button" disabled={submitting || !data?.runtimeFlags?.manualProcurement} onClick={() => postInspection(inspection)} className="rounded-full bg-foreground px-3 py-2 text-[9px] font-bold uppercase text-background disabled:opacity-40">Post receipt</button> : null}</div>)}{!connected?.inspections?.length ? <p className="rounded-xl border border-dashed border-foreground/12 p-5 text-center text-xs text-foreground/45">No receiving inspection is open.</p> : null}</div></section>}
          {activeSection === 'exceptions' && <ConnectedSummary title="Inventory exceptions" description="Count conflicts, custody disputes, recalled lots, and missing shift reservations remain persisted until reviewed." count={connected?.exceptions?.length || 0} empty="No connected inventory exception is currently visible." />}

          {activeSection === 'orders' && <section className="overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.025]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-5 py-4">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/[0.06]"><ShoppingCart className="h-4 w-4 text-foreground/55" /></div><div><h2 className="text-base font-semibold">Procurement snapshot</h2><p className="mt-0.5 text-xs text-foreground/45">Draft and open inventory commitments; never payment authorization.</p></div></div>
              <span className="rounded-full border border-foreground/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-foreground/50">{(data?.vendors || []).length} vendors</span>
            </div>
            {(data?.purchaseOrders || []).length ? (
              <div className="divide-y divide-foreground/10">
                {data.purchaseOrders.slice(0, 10).map((order) => {
                  const vendor = data.vendors.find((row) => row.id === order.vendorId);
                  const total = (BigInt(order.subtotalCents || 0) + BigInt(order.taxCents || 0) + BigInt(order.shippingCents || 0)).toString();
                  return (
                    <article key={order.id} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div><p className="text-sm font-semibold">{order.orderNumber}</p><p className="mt-1 text-[11px] text-foreground/45">{vendor?.name || 'Vendor not assigned'}{order.expectedOn ? ` · Expected ${order.expectedOn}` : ''}</p></div>
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-foreground/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/55">{connectedOrderFor(order.id)?.status || order.status}</span><span className="text-sm font-semibold tabular-nums">{cents(total)}</span>{order.status === 'draft' && <button type="button" disabled={submitting} onClick={() => openPurchaseOrderLine(order)} className="rounded-full border border-foreground/12 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] disabled:opacity-40">Add line</button>}{connected && order.status === 'draft' && <button type="button" disabled={submitting || !data?.runtimeFlags?.manualProcurement || !(order.lines || []).length || !purchaseOrderReceiptLocations.length} onClick={() => updateConnectedOrder(order, 'submit', { shipToLocationId: purchaseOrderReceiptLocations[0]?.id })} className="rounded-full bg-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Submit</button>}{connectedOrderFor(order.id)?.status === 'pending_approval' && <button type="button" disabled={submitting || !data?.runtimeFlags?.manualProcurement} onClick={() => updateConnectedOrder(order, 'approve', { expectedPayloadHash: connectedOrderFor(order.id)?.payload_hash })} className="rounded-full bg-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Approve exact payload</button>}{connectedOrderFor(order.id)?.status === 'approved' && <button type="button" disabled={submitting || !data?.runtimeFlags?.manualProcurement} onClick={() => exportConnectedOrder(order)} className="rounded-full border border-foreground/12 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] disabled:opacity-40">Open manual document</button>}{connectedOrderFor(order.id)?.status === 'approved' && <button type="button" disabled={submitting || !data?.runtimeFlags?.manualProcurement} onClick={() => recordConnectedOrderEvent(order, 'manual_sent')} className="rounded-full border border-foreground/12 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] disabled:opacity-40">Record sent</button>}{['sent', 'acknowledged'].includes(connectedOrderFor(order.id)?.status) && <button type="button" disabled={submitting || !data?.runtimeFlags?.manualProcurement} onClick={() => recordConnectedOrderEvent(order, connectedOrderFor(order.id)?.status === 'sent' ? 'acknowledged' : 'shipped')} className="rounded-full border border-foreground/12 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] disabled:opacity-40">Record {connectedOrderFor(order.id)?.status === 'sent' ? 'acknowledgement' : 'shipment'}</button>}</div>
                      </div>
                      {(order.lines || []).length ? <div className="space-y-2">{order.lines.map((line) => {
                        const outstanding = Math.max(0, Number(line.quantityOrdered || 0) - Number(line.quantityReceived || 0));
                        const connectedStatus = connectedOrderFor(order.id)?.status;
                        return <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-foreground/8 bg-background/50 px-3 py-2"><div><p className="text-xs font-semibold">{line.itemName}{line.variantName ? ` · ${line.variantName}` : ''}</p><p className="mt-0.5 text-[10px] text-foreground/45">{line.quantityReceived} / {line.quantityOrdered} received · {cents(line.unitCostCents)} each</p></div>{!connected && outstanding > 0 && ['draft', 'submitted', 'partially_received'].includes(order.status) && <button type="button" disabled={submitting} onClick={() => openPurchaseOrderReceipt(order, line)} className="rounded-full bg-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Receive</button>}{connected && outstanding > 0 && ['sent', 'acknowledged', 'partially_received'].includes(connectedStatus) && <button type="button" disabled={submitting || !data?.runtimeFlags?.manualProcurement} onClick={() => openPurchaseOrderReceipt(order, line)} className="rounded-full bg-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Inspect receipt</button>}</div>;
                      })}</div> : <p className="text-[11px] text-foreground/40">No ordered items yet. Add a line before receiving inventory.</p>}
                    </article>
                  );
                })}
              </div>
            ) : <div className="px-5 py-10 text-center text-xs text-foreground/45">No purchase orders recorded in the typed source.</div>}
          </section>}

          {activeSection === 'requests' && <section className="overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.025]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-5 py-4">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground/[0.06]"><ClipboardList className="h-4 w-4 text-foreground/55" /></div><div><h2 className="text-base font-semibold">Nurse kit restock queue</h2><p className="mt-0.5 text-xs text-foreground/45">Requests are tied to the nurse's assigned kit and structured reason.</p></div></div>
              <span className="rounded-full border border-foreground/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-foreground/50">{(data?.restockRequests || []).filter((request) => !['fulfilled', 'rejected', 'cancelled'].includes(request.status)).length} open</span>
            </div>
            {(data?.restockRequests || []).length ? (
              <div className="divide-y divide-foreground/10">
                {data.restockRequests.map((request) => (
                  <article key={request.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto] lg:items-center">
                    <div><p className="text-sm font-semibold">{request.locationName || 'Nurse kit'}</p><p className="mt-1 text-[11px] text-foreground/45">{request.nurseName || 'Assigned nurse'} · {String(request.reasonCode || request.reason_code || '').replaceAll('_', ' ')}</p></div>
                    <div className="flex flex-wrap gap-1.5">{(request.lines || []).map((line) => <span key={line.id || `${line.itemId}:${line.variantId || ''}`} className="rounded-full border border-foreground/10 bg-background/60 px-2.5 py-1 text-[10px] text-foreground/60">{line.itemName || 'Item'} · {line.requestedQuantity || line.requested_quantity}</span>)}</div>
                    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                      <span className="rounded-full border border-foreground/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-foreground/55">{request.status}</span>
                      {request.status === 'requested' && <button type="button" disabled={submitting} onClick={() => transitionRestock(request, 'approved')} className="rounded-full bg-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Approve</button>}
                      {request.status === 'approved' && <button type="button" disabled={submitting} onClick={() => transitionRestock(request, 'packing')} className="rounded-full bg-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Pack</button>}
                      {request.status === 'packing' && <button type="button" disabled={submitting} onClick={() => openFulfillment(request)} className="rounded-full bg-foreground px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Fulfill</button>}
                      {['requested', 'approved', 'packing'].includes(request.status) && <button type="button" disabled={submitting} onClick={() => transitionRestock(request, 'rejected')} className="rounded-full border border-foreground/12 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] disabled:opacity-40">Reject</button>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center"><Gauge className="mx-auto h-7 w-7 text-foreground/25" /><p className="mt-3 text-sm font-semibold">No restock requests yet</p><p className="mt-1 text-xs text-foreground/45">Nurse requests will appear here without exposing patient or appointment data.</p></div>
            )}
          </section>}
        </div>
      )}
    </AdminShell>
  );
}
