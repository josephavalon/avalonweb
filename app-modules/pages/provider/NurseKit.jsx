import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Package,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import SharedInventoryWorkspace from '@/components/inventory/SharedInventoryWorkspace';
import OperationalSourceUnavailable from '@/components/ops/OperationalSourceUnavailable';
import { apiGet, authedFetch } from '@/lib/apiClient';
import { invalidApiResponse, isResponseObject } from '@/lib/apiResponse';
import { nursePortalNav } from '@/lib/nursePortalNav';
import { useSeo } from '@/lib/seo';

const RESTOCK_REASONS = [
  ['BELOW_PAR', 'Below kit target'],
  ['UPCOMING_SHIFT', 'Upcoming shift'],
  ['EXPIRED_REMOVAL', 'Replacing expired stock'],
  ['DAMAGED', 'Replacing damaged stock'],
  ['COUNT_VARIANCE', 'Count does not match'],
];
const USE_REASONS = [
  ['SHIFT_USE', 'Used during a shift'],
  ['TRAINING_USE', 'Used for approved training'],
  ['ADMIN_AUTHORIZED', 'Authorized by Operations'],
];
const INPUT_CLASS = 'mt-1.5 min-h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground/40';

function requestKey(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function safeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function labelCase(value, fallback = '') {
  return safeText(value, fallback).replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeQuantity(value, fallback = '0') {
  const raw = String(value ?? fallback).trim();
  return /^-?\d+(?:\.\d{1,3})?$/.test(raw) ? raw : fallback;
}

function isPositiveQuantity(value) {
  const raw = String(value ?? '').trim();
  return /^\d+(?:\.\d{1,3})?$/.test(raw) && Number(raw) > 0;
}

function isExpired(date) {
  if (!date) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && time < Date.parse(new Date().toISOString().slice(0, 10));
}

function normalizeKit(raw) {
  if (!isResponseObject(raw) || typeof raw.assigned !== 'boolean' || !Array.isArray(raw.items) || !Array.isArray(raw.restockRequests)) {
    throw invalidApiResponse('Inventory returned an invalid nurse-kit response.');
  }
  if (raw.assigned && !isResponseObject(raw.location)) {
    throw invalidApiResponse('Inventory returned an invalid kit assignment.');
  }
  if (!raw.items.every((item) => isResponseObject(item) && safeText(item.itemId) && safeText(item.name))) {
    throw invalidApiResponse('Inventory returned invalid kit items.');
  }

  // Nurse UI is allowlisted: unexpected cost, vendor, global-location, or
  // other-custodian fields are never retained or rendered.
  const items = raw.items.map((item) => ({
    itemId: safeText(item.itemId),
    variantId: safeText(item.variantId) || null,
    lotId: safeText(item.lotId) || null,
    name: safeText(item.name, 'Inventory item'),
    variantName: safeText(item.variantName) || null,
    sku: safeText(item.sku) || null,
    barcode: safeText(item.barcode) || null,
    unit: safeText(item.unit, 'unit'),
    quantityOnHand: safeQuantity(item.quantityOnHand),
    aggregateQuantityOnHand: safeQuantity(item.aggregateQuantityOnHand, safeQuantity(item.quantityOnHand)),
    reorderQuantity: safeQuantity(item.reorderQuantity),
    parQuantity: safeQuantity(item.parQuantity),
    lowStock: item.lowStock === true,
    lotCode: safeText(item.lotCode) || null,
    expiresOn: safeText(item.expiresOn) || null,
    lastMovementAt: safeText(item.lastMovementAt) || null,
  }));
  const location = raw.assigned ? {
    id: safeText(raw.location.id),
    code: safeText(raw.location.code),
    name: safeText(raw.location.name, 'My nurse kit'),
    status: safeText(raw.location.status),
    assignmentStatus: safeText(raw.location.assignmentStatus),
    itemLineCount: Number(raw.location.itemLineCount || items.length),
    lowStockCount: Number(raw.location.lowStockCount || 0),
    expiringCount: Number(raw.location.expiringCount || 0),
  } : null;
  if (raw.assigned && !location.id) throw invalidApiResponse('Inventory returned an invalid kit location.');

  return {
    assigned: raw.assigned,
    location,
    items,
    restockRequests: raw.restockRequests
      .filter(isResponseObject)
      .map((request) => ({
        id: safeText(request.id),
        status: safeText(request.status, 'requested'),
        reasonCode: safeText(request.reason_code || request.reasonCode),
        requestedAt: safeText(request.requested_at || request.requestedAt),
        fulfilledAt: safeText(request.fulfilled_at || request.fulfilledAt) || null,
        itemId: safeText(request.item_id || request.itemId) || null,
        variantId: safeText(request.variant_id || request.variantId) || null,
      }))
      .filter((request) => request.id),
  };
}

function parseGetResponse(response) {
  if (!isResponseObject(response) || response.status !== 'AVAILABLE') {
    throw invalidApiResponse('Inventory returned an invalid nurse-kit response.');
  }
  return normalizeKit(response.kit);
}

function suggestedRestock(item) {
  const target = Number(item.parQuantity || 0);
  const onHand = Number(item.aggregateQuantityOnHand || item.quantityOnHand || 0);
  if (!Number.isFinite(target) || !Number.isFinite(onHand)) return '1';
  const shortage = Math.ceil(Math.max(1, target - onHand) * 1000) / 1000;
  return String(shortage);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date unavailable';
}

function ActionDialog({ action, busy, error, onClose, onChange, onConfirm }) {
  if (!action) return null;
  const restock = action.type === 'restock';
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="kit-action-title" className="w-full max-w-md rounded-[1.75rem] border border-foreground/10 bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-foreground/40">My kit</p>
            <h2 id="kit-action-title" className="mt-1 text-xl font-semibold">{restock ? 'Request restock' : 'Confirm item used'}</h2>
            <p className="mt-1 text-sm text-foreground/55">{action.item.name}{action.item.variantName ? ` · ${action.item.variantName}` : ''}{action.item.lotCode ? ` · Lot ${action.item.lotCode}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/12 disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>

        {restock ? (
          <div className="mt-5 grid gap-4">
            <label className="text-xs font-semibold text-foreground/65">Quantity requested
              <input required type="number" min="0.001" step="0.001" value={action.quantity} onChange={(event) => onChange({ quantity: event.target.value, idempotencyKey: requestKey('nurse-kit-restock') })} className={INPUT_CLASS} />
            </label>
            <label className="text-xs font-semibold text-foreground/65">Reason
              <select value={action.reasonCode} onChange={(event) => onChange({ reasonCode: event.target.value, idempotencyKey: requestKey('nurse-kit-restock') })} className={INPUT_CLASS}>
                {RESTOCK_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <p className="rounded-xl border border-foreground/10 bg-foreground/[0.035] p-3 text-xs leading-relaxed text-foreground/55">This sends a structured request to Avalon Operations. It does not change your count or approve fulfillment.</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <p className="text-sm font-semibold text-amber-900">Remove 1 {action.item.unit} from your kit?</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">Confirm only after use. This creates a permanent stock movement and lowers the on-hand count.</p>
            </div>
            <label className="text-xs font-semibold text-foreground/65">Structured reason
              <select value={action.reasonCode} onChange={(event) => onChange({ reasonCode: event.target.value, idempotencyKey: requestKey('nurse-kit-use') })} className={INPUT_CLASS}>
                {USE_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
        )}

        {error ? <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-xs leading-relaxed text-red-700">{error} Nothing else on this screen changed; retry keeps the same request identifier.</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-full border border-foreground/12 px-4 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-40">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy || (restock && !isPositiveQuantity(action.quantity))} className="min-h-11 rounded-full bg-foreground px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">
            {busy ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : restock ? <Send className="mr-1 inline h-3.5 w-3.5" /> : <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}
            {busy ? 'Saving…' : restock ? 'Send request' : 'Confirm used 1'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function NurseKit() {
  useSeo({
    title: 'My Kit — Avalon Vitality',
    description: 'Review assigned nurse-kit stock, record use, and request restock.',
    path: '/provider/kit',
    robots: 'noindex, nofollow, noarchive',
  });
  const [state, setState] = useState({ loading: true, error: '', kit: null });
  const [action, setAction] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const kit = parseGetResponse(await apiGet('/api/me/kit'));
      setState({ loading: false, error: '', kit });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'Your kit is unavailable.' }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openUse = useCallback((item) => {
    setAction({ type: 'use', item, reasonCode: 'SHIFT_USE', idempotencyKey: requestKey('nurse-kit-use') });
    setActionError('');
    setNotice('');
  }, []);
  const openRestock = useCallback((item) => {
    setAction({
      type: 'restock',
      item,
      quantity: suggestedRestock(item),
      reasonCode: isExpired(item.expiresOn) ? 'EXPIRED_REMOVAL' : item.lowStock ? 'BELOW_PAR' : 'UPCOMING_SHIFT',
      idempotencyKey: requestKey('nurse-kit-restock'),
    });
    setActionError('');
    setNotice('');
  }, []);

  const confirm = useCallback(async () => {
    if (!action) return;
    if (action.type === 'restock' && !isPositiveQuantity(action.quantity)) {
      setActionError('Enter a restock quantity greater than zero with no more than three decimal places.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const payload = action.type === 'restock'
        ? {
            action: 'request_restock',
            reasonCode: action.reasonCode,
            lines: [{ itemId: action.item.itemId, variantId: action.item.variantId, quantity: action.quantity }],
          }
        : {
            action: 'record_movement',
            movementType: 'consume',
            reasonCode: action.reasonCode,
            itemId: action.item.itemId,
            variantId: action.item.variantId,
            lotId: action.item.lotId,
            quantity: '1',
          };
      const response = await authedFetch('/api/me/kit', {
        method: 'POST',
        headers: { 'Idempotency-Key': action.idempotencyKey },
        body: JSON.stringify(payload),
      });
      if (!isResponseObject(response) || response.ok !== true || !isResponseObject(response.kit)) {
        throw invalidApiResponse('Inventory returned an invalid confirmation.');
      }
      const kit = normalizeKit(response.kit);
      const completedType = action.type;
      setState({ loading: false, error: '', kit });
      setAction(null);
      setNotice(completedType === 'restock' ? 'Restock request saved for Avalon Operations.' : 'Kit count updated from the confirmed stock movement.');
    } catch (error) {
      setActionError(error.message || 'The kit action could not be saved.');
    } finally {
      setBusy(false);
    }
  }, [action]);

  const acceptAssignment = useCallback(async () => {
    if (!state.kit?.location || state.kit.location.assignmentStatus !== 'assigned') return;
    setBusy(true);
    setNotice('');
    try {
      const response = await authedFetch('/api/me/kit', {
        method: 'POST',
        headers: { 'Idempotency-Key': requestKey('nurse-kit-accept') },
        body: JSON.stringify({ action: 'accept_assignment' }),
      });
      if (!isResponseObject(response) || response.ok !== true || !isResponseObject(response.kit)) {
        throw invalidApiResponse('Inventory returned an invalid kit acceptance.');
      }
      setState({ loading: false, error: '', kit: normalizeKit(response.kit) });
      setNotice('Kit custody accepted. Your future count and restock actions remain tied to this assignment.');
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || 'Kit custody could not be accepted.' }));
    } finally {
      setBusy(false);
    }
  }, [state.kit]);

  const navItems = useMemo(() => nursePortalNav(), []);
  const kit = state.kit;
  const locations = kit?.location ? [{ id: kit.location.id, name: kit.location.name }] : [];
  const pendingRestockKeys = useMemo(() => new Set((kit?.restockRequests || [])
    .filter((request) => ['requested', 'approved', 'packing'].includes(request.status) && request.itemId)
    .map((request) => `${request.itemId}:${request.variantId || ''}`)), [kit?.restockRequests]);

  if (state.loading && !kit) {
    return (
      <main className="min-h-dvh bg-background px-4 pb-28 pt-8 text-foreground">
        <section className="mx-auto max-w-5xl rounded-3xl border border-foreground/10 bg-foreground/[0.025] p-6">
          <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading your assigned kit</p>
        </section>
        <MobileNavBar items={navItems} columns={4} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
      </main>
    );
  }

  if (!kit && state.error) {
    return (
      <main className="min-h-dvh bg-background px-4 pb-28 pt-8 text-foreground">
        <section className="mx-auto max-w-5xl">
          <OperationalSourceUnavailable
            title="My Kit unavailable"
            description="Your assigned kit and stored counts could not be verified. No stock is shown and no movement or restock action is available until the typed inventory source reconnects."
          />
          <button type="button" onClick={load} className="mt-4 min-h-11 rounded-full border border-foreground/15 px-4 text-[10px] font-bold uppercase tracking-[0.12em]">Retry My Kit</button>
        </section>
        <MobileNavBar items={navItems} columns={4} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-8 text-foreground">
      <section className="mx-auto max-w-5xl space-y-5">
        {notice ? <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p> : null}
        {state.error ? <p role="alert" className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-800">The latest refresh failed. Existing server-confirmed kit state remains visible; retry before recording another action.</p> : null}

        <SharedInventoryWorkspace
          mode="nurse"
          title="My Kit"
          subtitle="See only the supplies assigned to your own kit. Confirm use after it happens, or send a structured restock request to Avalon Operations."
          locations={locations}
          selectedLocationId={kit?.location?.id || ''}
          items={kit?.items || []}
          loading={state.loading}
          onRefresh={load}
          onUseOne={openUse}
          onRequestRestock={openRestock}
          pendingRestockKeys={pendingRestockKeys}
          actionsDisabled={kit?.location?.assignmentStatus !== 'accepted' || kit?.location?.status !== 'active'}
          sourceMessage={kit?.assigned
            ? kit.location.status === 'active'
              ? 'This nurse view intentionally excludes prices, vendors, purchase orders, central inventory, and every other nurse kit.'
              : 'This kit is on operational hold. Counts remain visible, but use and restock actions are disabled until Avalon Operations reactivates it.'
            : 'No active primary kit is assigned to your nurse profile. Avalon Operations must assign one before stock or actions can appear.'}
          headerActions={kit?.location ? (
            <>
              <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.035] px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/60">
                <ShieldCheck className="h-3.5 w-3.5" /> {labelCase(kit.location.assignmentStatus, 'Assigned')}
              </span>
              {kit.location.assignmentStatus === 'assigned' ? <button type="button" onClick={acceptAssignment} disabled={busy} className="min-h-10 rounded-full bg-foreground px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-background disabled:opacity-40">Accept custody</button> : null}
            </>
          ) : null}
        />

        {kit?.assigned && (
          <section className="rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.025] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-foreground/[0.07]"><Package className="h-5 w-5 text-foreground/55" /></div>
              <div><h2 className="text-base font-semibold">Recent restock requests</h2><p className="mt-1 text-xs leading-relaxed text-foreground/50">Request status only. Fulfillment and count changes remain controlled by Avalon Operations.</p></div>
            </div>
            <div className="mt-4 grid gap-2">
              {(kit.restockRequests || []).slice(0, 5).map((request) => (
                <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-foreground/8 bg-background/55 px-3 py-2.5">
                  <div><p className="text-xs font-semibold">{labelCase(request.reasonCode, 'Restock')}</p><p className="mt-0.5 text-[10px] text-foreground/45">{formatDate(request.requestedAt)}</p></div>
                  <span className="rounded-full border border-foreground/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-foreground/55">{labelCase(request.status, 'Requested')}</span>
                </div>
              ))}
              {!kit.restockRequests?.length ? <p className="rounded-xl border border-dashed border-foreground/12 p-5 text-center text-xs text-foreground/45">No restock request recorded yet.</p> : null}
            </div>
          </section>
        )}
      </section>
      <MobileNavBar items={navItems} columns={4} maxWidth="shift" mobileOnly={false} ariaLabel="Nurse work" />
      <ActionDialog
        action={action}
        busy={busy}
        error={actionError}
        onClose={() => { if (!busy) { setAction(null); setActionError(''); } }}
        onChange={(changes) => { setAction((current) => current ? { ...current, ...changes } : current); setActionError(''); }}
        onConfirm={confirm}
      />
    </main>
  );
}
