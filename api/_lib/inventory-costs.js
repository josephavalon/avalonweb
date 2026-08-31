const COST_MOVEMENT_TYPES = new Set(['receive', 'consume', 'expire', 'shrink', 'return', 'adjust']);
const READ_PAGE_SIZE = 500;
const IN_FILTER_CHUNK_SIZE = 75;
const READ_LIMITS = Object.freeze({
  balances: 20000,
  movements30d: 50000,
  openPurchaseOrders: 20000,
  costEvents30d: 50000,
  items: 20000,
  lots: 50000,
  variants: 50000,
});

function readLimitError(label, maxRows) {
  const error = new Error(`${label} exceeds the verified read ceiling of ${maxRows} rows.`);
  error.code = 'inventory_read_limit_exceeded';
  return error;
}

async function readPaged(makeQuery, { label, maxRows, pageSize = READ_PAGE_SIZE }) {
  const rows = [];
  let from = 0;
  while (true) {
    // Probe one row beyond the ceiling so an exact-boundary response cannot be
    // mistaken for a complete financial dataset.
    const take = Math.min(pageSize, maxRows + 1 - rows.length);
    const result = await makeQuery().range(from, from + take - 1);
    if (result.error) throw result.error;
    const page = result.data || [];
    rows.push(...page);
    if (rows.length > maxRows) throw readLimitError(label, maxRows);
    if (page.length < take) return rows;
    from += page.length;
  }
}

async function readByIds(values, makeQuery, { label, maxRows }) {
  const ids = [...new Set((values || []).filter(Boolean))];
  const rows = [];
  for (let index = 0; index < ids.length; index += IN_FILTER_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + IN_FILTER_CHUNK_SIZE);
    const page = await readPaged(() => makeQuery(chunk), {
      label,
      maxRows: Math.max(0, maxRows - rows.length),
    });
    rows.push(...page);
    if (rows.length > maxRows) throw readLimitError(label, maxRows);
  }
  return rows;
}

function bigint(value) {
  try { return BigInt(String(value ?? 0)); } catch { return 0n; }
}

function sumBigint(rows, key) {
  return rows.reduce((total, row) => total + bigint(row?.[key]), 0n);
}

// os_stock_transactions.quantity_delta is numeric(14,3). Convert it to
// thousandths without passing money through floating-point arithmetic.
function quantityThousandths(value) {
  const raw = String(value ?? '0').trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d{1,3}))?$/);
  if (!match) return 0n;
  const scale = (match[3] || '').padEnd(3, '0');
  const absolute = BigInt(match[2]) * 1000n + BigInt(scale || '0');
  return match[1] ? -absolute : absolute;
}

function movementCostCents(row, lots, variants) {
  const lotRecord = row.lot_id ? lots.get(row.lot_id) : null;
  const lotContextValid = Boolean(lotRecord)
    && lotRecord.item_id === row.item_id
    && (!row.variant_id || !lotRecord.variant_id || row.variant_id === lotRecord.variant_id);
  const direct = lotContextValid ? row.unit_cost_cents : null;
  const lot = lotContextValid ? lotRecord.unit_cost_cents : null;
  const lotVariantId = lotContextValid ? (lotRecord.variant_id || row.variant_id) : null;
  const variant = lotVariantId ? variants.get(lotVariantId)?.unit_cost_cents : null;
  // A lot is the acquisition-cost boundary. Even a legacy movement snapshot is
  // not finance-ready when no valid lot identifies the stock cohort.
  const unitCost = (lotContextValid ? [direct, lot, variant] : [])
    .map((value) => bigint(value))
    .find((value) => value > 0n) || 0n;
  const quantity = quantityThousandths(row.quantity_delta);
  const absoluteQuantity = quantity < 0n ? -quantity : quantity;
  if (unitCost <= 0n || absoluteQuantity <= 0n) {
    return { unitCostCents: '0', totalCostCents: '0', costReady: false };
  }
  const total = (absoluteQuantity * unitCost + 500n) / 1000n;
  return {
    unitCostCents: unitCost.toString(),
    totalCostCents: total.toString(),
    costReady: total > 0n,
  };
}

function directionValid(row) {
  const quantity = quantityThousandths(row.quantity_delta);
  if (row.transaction_type === 'receive') return quantity > 0n;
  if (['consume', 'expire', 'shrink', 'return'].includes(row.transaction_type)) return quantity < 0n;
  if (row.transaction_type === 'adjust') return quantity !== 0n;
  return false;
}

function movementClass(row) {
  const quantity = quantityThousandths(row.quantity_delta);
  if (row.transaction_type === 'receive') return 'RECEIPT';
  if (row.transaction_type === 'consume') return 'CONSUMPTION';
  if (row.transaction_type === 'expire') return 'EXPIRY';
  if (row.transaction_type === 'shrink') return 'SHRINKAGE';
  if (row.transaction_type === 'return') return 'RETURN_TO_VENDOR';
  if (row.transaction_type === 'adjust') return quantity > 0n ? 'ADJUSTMENT_GAIN' : 'ADJUSTMENT_LOSS';
  return 'TRANSFER';
}

function emptyResult() {
  return {
    metrics: {
      inventoryValueCents: '0',
      receiptCost30dCents: '0',
      consumptionCost30dCents: '0',
      postedConsumptionCost30dCents: '0',
      writeOffCost30dCents: '0',
      postedWriteOffCost30dCents: '0',
      openPurchaseOrderCommitmentCents: '0',
      openPurchaseOrderCount: 0,
      uncostedMovementCount: 0,
      invalidDirectionCount: 0,
      unpreparedMovementCount: 0,
      preparedJournalCount: 0,
      postedJournalCount: 0,
    },
    balances: [],
    recentMovements: [],
  };
}

export async function loadInventoryCostData(db, tenantId, { recentLimit = 50 } = {}) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [balances, movementRows, purchaseOrders, costEvents] = await Promise.all([
    readPaged(() => db.from('os_inventory_balances')
      .select('item_id,name,sku,reorder_point,quantity_on_hand,inventory_value_cents')
      .eq('tenant_id', tenantId)
      .order('name').order('item_id'), {
      label: 'Inventory value balances', maxRows: READ_LIMITS.balances,
    }),
    readPaged(() => db.from('os_stock_transactions')
      .select('id,item_id,variant_id,lot_id,transaction_type,quantity_delta,unit_cost_cents,occurred_at,created_at')
      .eq('tenant_id', tenantId)
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Inventory movements in the last 30 days', maxRows: READ_LIMITS.movements30d,
    }),
    readPaged(() => db.from('os_purchase_orders')
      .select('id,order_number,status,subtotal_cents,tax_cents,shipping_cents,expected_on,created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'submitted', 'partially_received'])
      .order('created_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Open inventory purchase orders', maxRows: READ_LIMITS.openPurchaseOrders,
    }),
    readPaged(() => db.from('inventory_cost_event_status')
      .select('id,stock_transaction_id,cost_event_type,total_cost_cents,currency,posting_date,ledger_journal_id,journal_status,created_at')
      .eq('tenant_id', tenantId)
      .gte('posting_date', since.slice(0, 10))
      .order('created_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Inventory cost events in the last 30 days', maxRows: READ_LIMITS.costEvents30d,
    }),
  ]);
  const movements = movementRows.filter((row) => COST_MOVEMENT_TYPES.has(row.transaction_type));
  if (!balances.length && !movements.length && !purchaseOrders.length && !costEvents.length) return emptyResult();

  const itemIds = [...new Set(movements.map((row) => row.item_id).filter(Boolean))];
  const lotIds = [...new Set(movements.map((row) => row.lot_id).filter(Boolean))];
  const [itemRows, lotRows] = await Promise.all([
    readByIds(itemIds, (ids) => db.from('os_inventory_items')
      .select('id,name,sku,unit,status,archived_at')
      .eq('tenant_id', tenantId).in('id', ids).order('id'), {
      label: 'Inventory cost item references', maxRows: READ_LIMITS.items,
    }),
    readByIds(lotIds, (ids) => db.from('os_inventory_lots')
      .select('id,item_id,variant_id,lot_code,expires_on,unit_cost_cents')
      .eq('tenant_id', tenantId).in('id', ids).order('id'), {
      label: 'Inventory cost lot references', maxRows: READ_LIMITS.lots,
    }),
  ]);
  // Lots can carry the authoritative variant even when a legacy movement did
  // not. Stage lot references first, then fetch the complete variant set.
  const variantIds = [...new Set([
    ...movements.map((row) => row.variant_id),
    ...lotRows.map((row) => row.variant_id),
  ].filter(Boolean))];
  const variantRows = await readByIds(variantIds, (ids) => db.from('os_inventory_variants')
    .select('id,item_id,name,unit_cost_cents')
    .eq('tenant_id', tenantId).in('id', ids).order('id'), {
    label: 'Inventory cost variant references', maxRows: READ_LIMITS.variants,
  });

  const items = new Map(itemRows.map((row) => [row.id, row]));
  const lots = new Map(lotRows.map((row) => [row.id, row]));
  const variants = new Map(variantRows.map((row) => [row.id, row]));
  const costEventsByMovement = new Map(costEvents.map((row) => [row.stock_transaction_id, row]));
  const shapedMovements = movements.map((row) => {
    const item = items.get(row.item_id) || {};
    const lot = row.lot_id ? lots.get(row.lot_id) : null;
    const cost = movementCostCents(row, lots, variants);
    const event = costEventsByMovement.get(row.id);
    const validDirection = directionValid(row);
    return {
      id: row.id,
      itemId: row.item_id,
      itemName: item.name || 'Inventory item',
      sku: item.sku || null,
      unit: item.unit || 'unit',
      lotCode: lot?.lot_code || null,
      expiresOn: lot?.expires_on || null,
      movementType: row.transaction_type,
      costEventType: movementClass(row),
      quantityDelta: String(row.quantity_delta),
      occurredAt: row.occurred_at,
      validDirection,
      ...cost,
      costEventId: event?.id || null,
      ledgerJournalId: event?.ledger_journal_id || null,
      postingStatus: event?.journal_status || 'UNPREPARED',
    };
  });

  const totalFor = (predicate) => shapedMovements
    .filter(predicate)
    .reduce((total, row) => total + bigint(row.totalCostCents), 0n)
    .toString();
  const postedCost = (types) => costEvents
    .filter((row) => row.journal_status === 'POSTED' && types.includes(row.cost_event_type))
    .reduce((total, row) => total + bigint(row.total_cost_cents), 0n)
    .toString();
  const openCommitment = purchaseOrders.reduce((total, row) => total
    + bigint(row.subtotal_cents)
    + bigint(row.tax_cents)
    + bigint(row.shipping_cents), 0n);

  return {
    metrics: {
      inventoryValueCents: sumBigint(balances, 'inventory_value_cents').toString(),
      receiptCost30dCents: totalFor((row) => row.costEventType === 'RECEIPT'),
      consumptionCost30dCents: totalFor((row) => row.costEventType === 'CONSUMPTION'),
      postedConsumptionCost30dCents: postedCost(['CONSUMPTION']),
      writeOffCost30dCents: totalFor((row) => ['EXPIRY', 'SHRINKAGE', 'ADJUSTMENT_LOSS'].includes(row.costEventType)),
      postedWriteOffCost30dCents: postedCost(['EXPIRY', 'SHRINKAGE', 'ADJUSTMENT_LOSS']),
      openPurchaseOrderCommitmentCents: openCommitment.toString(),
      openPurchaseOrderCount: purchaseOrders.length,
      uncostedMovementCount: shapedMovements.filter((row) => !row.costReady).length,
      invalidDirectionCount: shapedMovements.filter((row) => !row.validDirection).length,
      unpreparedMovementCount: shapedMovements.filter((row) => row.postingStatus === 'UNPREPARED').length,
      preparedJournalCount: costEvents.filter((row) => row.journal_status === 'DRAFT').length,
      postedJournalCount: costEvents.filter((row) => row.journal_status === 'POSTED').length,
    },
    balances: balances.map((row) => ({
      itemId: row.item_id,
      name: row.name,
      sku: row.sku || null,
      reorderPoint: String(row.reorder_point),
      quantityOnHand: String(row.quantity_on_hand),
      inventoryValueCents: String(row.inventory_value_cents),
    })),
    recentMovements: shapedMovements.slice(0, Math.max(1, Math.min(Number(recentLimit) || 50, 100))),
  };
}
