function asString(value, fallback = '0') {
  return value === null || value === undefined ? fallback : String(value);
}

function mapRows(rows) {
  return new Map((rows || []).map((row) => [row.id, row]));
}

const READ_PAGE_SIZE = 500;
const IN_FILTER_CHUNK_SIZE = 75;
const READ_LIMITS = Object.freeze({
  locations: 5000,
  balances: 50000,
  items: 20000,
  variants: 50000,
  lots: 50000,
  vendors: 10000,
  purchaseOrders: 20000,
  purchaseOrderLines: 50000,
  openRestocks: 10000,
  restockHistory: 20000,
  restockLines: 50000,
  providers: 5000,
  profiles: 5000,
  parLevels: 50000,
  nurseKitRows: 5000,
  nurseOpenRestocks: 100,
  nurseRestockHistory: 5000,
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
    // Read one row beyond the ceiling so an exact-boundary result cannot be
    // mistaken for a complete dataset.
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

async function loadInventoryReferences(db, tenantId, balances) {
  const itemIds = [...new Set((balances || []).map((row) => row.item_id).filter(Boolean))];
  const lotIds = [...new Set((balances || []).map((row) => row.lot_id).filter(Boolean))];
  const [itemRows, lotRows] = await Promise.all([
    readByIds(itemIds, (ids) => db.from('os_inventory_items')
      .select('id,folder_id,preferred_vendor_id,name,sku,barcode,qr_code,unit,reorder_point,tags,status,archived_at')
      .eq('tenant_id', tenantId).in('id', ids).order('id'), {
      label: 'Inventory item references', maxRows: READ_LIMITS.items,
    }),
    readByIds(lotIds, (ids) => db.from('os_inventory_lots')
      .select('id,item_id,variant_id,lot_code,expires_on,received_at,unit_cost_cents')
      .eq('tenant_id', tenantId).in('id', ids).order('id'), {
      label: 'Inventory lot references', maxRows: READ_LIMITS.lots,
    }),
  ]);
  const variantIds = [...new Set([
    ...(balances || []).map((row) => row.variant_id),
    ...lotRows.map((row) => row.variant_id),
  ].filter(Boolean))];
  const variantRows = await readByIds(variantIds, (ids) => db.from('os_inventory_variants')
    .select('id,item_id,name,sku,barcode,attributes,unit_cost_cents,archived_at')
    .eq('tenant_id', tenantId).in('id', ids).order('id'), {
    label: 'Inventory variant references', maxRows: READ_LIMITS.variants,
  });
  return {
    items: mapRows(itemRows),
    variants: mapRows(variantRows),
    lots: mapRows(lotRows),
  };
}

function itemLine(balance, refs, par, { aggregateQuantity = balance.quantity_on_hand, includeCost = false } = {}) {
  const item = refs.items.get(balance.item_id) || {};
  const variant = balance.variant_id ? refs.variants.get(balance.variant_id) : null;
  const lot = balance.lot_id ? refs.lots.get(balance.lot_id) : null;
  const lotVariant = lot?.variant_id ? refs.variants.get(lot.variant_id) : variant;
  const quantity = asString(balance.quantity_on_hand);
  const aggregate = asString(aggregateQuantity);
  const reorder = asString(par?.reorder_quantity ?? item.reorder_point ?? 0);
  const row = {
    itemId: balance.item_id,
    variantId: balance.variant_id || null,
    lotId: balance.lot_id || null,
    name: item.name || 'Inventory item',
    variantName: variant?.name || null,
    sku: variant?.sku || item.sku || null,
    barcode: variant?.barcode || item.barcode || null,
    unit: item.unit || 'unit',
    quantityOnHand: quantity,
    aggregateQuantityOnHand: aggregate,
    reorderQuantity: reorder,
    parQuantity: asString(par?.par_quantity ?? item.reorder_point ?? 0),
    parVersion: Number(par?.version || 0),
    lowStock: Number(aggregate) <= Number(reorder),
    lotCode: lot?.lot_code || null,
    expiresOn: lot?.expires_on || null,
    lastMovementAt: balance.last_movement_at || null,
  };
  if (includeCost) {
    // A lot is the acquisition-cost boundary. Never promote a legacy balance
    // snapshot into finance-ready cost when the stock has no lot. A lot may
    // inherit the catalog default of the variant recorded on that lot.
    const lotCostCandidates = lot ? [lot.unit_cost_cents, lotVariant?.unit_cost_cents] : [];
    const unitCost = lotCostCandidates.find((value) => {
      try { return BigInt(String(value ?? 0)) > 0n; } catch { return false; }
    });
    row.unitCostCents = asString(unitCost, '0');
  }
  return row;
}

export async function loadAdminInventory(db, tenantId) {
  const [
    locationRows,
    balances,
    allItemRows,
    allVariantRows,
    allLotRows,
    vendorRows,
    purchaseOrderRows,
    openRestockRows,
    restockHistoryRows,
    providerRows,
  ] = await Promise.all([
    readPaged(() => db.from('os_inventory_locations')
      .select('id,location_type,location_code,name,nurse_profile_id,status,version,updated_at')
      .eq('tenant_id', tenantId).order('name').order('id'), {
      label: 'Inventory locations', maxRows: READ_LIMITS.locations,
    }),
    readPaged(() => db.from('os_inventory_location_balances')
      .select('location_id,item_id,variant_id,lot_id,quantity_on_hand,unit_cost_cents,last_movement_at')
      .eq('tenant_id', tenantId)
      .order('location_id').order('item_id').order('variant_id', { nullsFirst: true }).order('lot_id', { nullsFirst: true }), {
      label: 'Inventory location balances', maxRows: READ_LIMITS.balances,
    }),
    readPaged(() => db.from('os_inventory_items')
      .select('id,folder_id,preferred_vendor_id,name,sku,barcode,qr_code,unit,reorder_point,tags,status,archived_at,created_at,updated_at')
      .eq('tenant_id', tenantId).is('archived_at', null).order('name').order('id'), {
      label: 'Inventory catalog', maxRows: READ_LIMITS.items,
    }),
    readPaged(() => db.from('os_inventory_variants')
      .select('id,item_id,name,sku,barcode,attributes,unit_cost_cents,version,created_at,updated_at')
      .eq('tenant_id', tenantId).is('archived_at', null).order('name').order('id'), {
      label: 'Inventory variants', maxRows: READ_LIMITS.variants,
    }),
    readPaged(() => db.from('os_inventory_lots')
      .select('id,item_id,variant_id,lot_code,expires_on,received_at,unit_cost_cents,created_at')
      .eq('tenant_id', tenantId).order('received_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }), {
      label: 'Inventory lots', maxRows: READ_LIMITS.lots,
    }),
    readPaged(() => db.from('os_inventory_vendors')
      .select('id,name,status,version,updated_at')
      .eq('tenant_id', tenantId).is('archived_at', null).order('name').order('id'), {
      label: 'Inventory vendors', maxRows: READ_LIMITS.vendors,
    }),
    readPaged(() => db.from('os_purchase_orders')
      .select('id,vendor_id,order_number,status,expected_on,subtotal_cents,tax_cents,shipping_cents,version,created_at,updated_at')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Inventory purchase orders', maxRows: READ_LIMITS.purchaseOrders,
    }),
    readPaged(() => db.from('os_inventory_restock_requests')
      .select('id,location_id,nurse_profile_id,status,reason_code,requested_at,fulfilled_at,fulfillment_reference,fulfillment_transfer_group_id,last_transition_reason_code,version')
      .eq('tenant_id', tenantId).in('status', ['requested', 'approved', 'packing'])
      .order('requested_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Open inventory restock requests', maxRows: READ_LIMITS.openRestocks,
    }),
    readPaged(() => db.from('os_inventory_restock_requests')
      .select('id,location_id,nurse_profile_id,status,reason_code,requested_at,fulfilled_at,fulfillment_reference,fulfillment_transfer_group_id,last_transition_reason_code,version')
      .eq('tenant_id', tenantId).in('status', ['fulfilled', 'rejected', 'cancelled'])
      .order('requested_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Inventory restock history', maxRows: READ_LIMITS.restockHistory,
    }),
    readPaged(() => db.from('provider_profiles')
      .select('id,profile_id,provider_role,active,credential_status')
      .eq('tenant_id', tenantId).in('provider_role', ['rn', 'np']).eq('active', true).order('id'), {
      label: 'Active nurse providers', maxRows: READ_LIMITS.providers,
    }),
  ]);
  const restockRows = [...openRestockRows, ...restockHistoryRows]
    .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)) || String(b.id).localeCompare(String(a.id)));
  const nurseProfileIds = [...new Set(providerRows.map((row) => row.profile_id).filter(Boolean))];
  const nurseProfileRows = await readByIds(nurseProfileIds, (ids) => db.from('profiles')
    .select('id,full_name,email,status').eq('tenant_id', tenantId).in('id', ids).order('id'), {
    label: 'Nurse profiles', maxRows: READ_LIMITS.profiles,
  });
  const nurseProfiles = mapRows(nurseProfileRows);
  const refs = await loadInventoryReferences(db, tenantId, balances);
  for (const row of allItemRows) refs.items.set(row.id, row);
  for (const row of allVariantRows) refs.variants.set(row.id, row);
  for (const row of allLotRows) refs.lots.set(row.id, row);
  const purchaseOrderIds = purchaseOrderRows.map((row) => row.id);
  const purchaseOrderLineRows = await readByIds(purchaseOrderIds, (ids) => db.from('os_purchase_order_lines')
    .select('id,purchase_order_id,item_id,variant_id,quantity_ordered,quantity_received,unit_cost_cents,created_at')
    .eq('tenant_id', tenantId).in('purchase_order_id', ids).order('purchase_order_id').order('id'), {
    label: 'Inventory purchase order lines', maxRows: READ_LIMITS.purchaseOrderLines,
  });
  const purchaseOrderRefs = await loadInventoryReferences(db, tenantId, purchaseOrderLineRows.map((row) => ({
    item_id: row.item_id, variant_id: row.variant_id, lot_id: null,
  })));
  for (const [id, row] of purchaseOrderRefs.items) refs.items.set(id, row);
  for (const [id, row] of purchaseOrderRefs.variants) refs.variants.set(id, row);
  const restockRequestIds = restockRows.map((row) => row.id);
  const restockLineRows = await readByIds(restockRequestIds, (ids) => db.from('os_inventory_restock_request_lines')
    .select('id,restock_request_id,item_id,variant_id,requested_quantity')
    .eq('tenant_id', tenantId).in('restock_request_id', ids).order('restock_request_id').order('id'), {
    label: 'Inventory restock request lines', maxRows: READ_LIMITS.restockLines,
  });
  const locationIds = locationRows.map((row) => row.id);
  const parRows = await readByIds(locationIds, (ids) => db.from('os_inventory_location_par_levels')
    .select('location_id,item_id,variant_id,par_quantity,reorder_quantity,version')
    .eq('tenant_id', tenantId).in('location_id', ids)
    .order('location_id').order('item_id').order('variant_id', { nullsFirst: true }), {
    label: 'Inventory par levels', maxRows: READ_LIMITS.parLevels,
  });
  const parMap = new Map(parRows.map((row) => [
    `${row.location_id}:${row.item_id}:${row.variant_id || ''}`,
    row,
  ]));
  const aggregateByLocation = new Map();
  for (const balance of balances) {
    const key = `${balance.location_id}:${balance.item_id}:${balance.variant_id || ''}`;
    aggregateByLocation.set(key, Number(aggregateByLocation.get(key) || 0) + Number(balance.quantity_on_hand || 0));
  }
  const lines = balances.map((balance) => itemLine(
    balance,
    refs,
    parMap.get(`${balance.location_id}:${balance.item_id}:${balance.variant_id || ''}`),
    {
      aggregateQuantity: aggregateByLocation.get(`${balance.location_id}:${balance.item_id}:${balance.variant_id || ''}`) || 0,
      includeCost: true,
    },
  ));
  const linesByLocation = new Map(locationIds.map((id) => [id, []]));
  balances.forEach((balance, index) => linesByLocation.get(balance.location_id)?.push(lines[index]));
  const locations = locationRows.map((location) => {
    const locationLines = linesByLocation.get(location.id) || [];
    return {
      id: location.id,
      type: location.location_type,
      code: location.location_code,
      name: location.name,
      nurseProfileId: location.nurse_profile_id,
      status: location.status,
      version: location.version,
      itemLineCount: locationLines.length,
      lowStockCount: new Set(locationLines.filter((line) => line.lowStock).map((line) => `${line.itemId}:${line.variantId || ''}`)).size,
      items: locationLines,
    };
  });
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const nurseNameByProfileId = new Map(providerRows.map((provider) => {
    const profile = nurseProfiles.get(provider.profile_id) || {};
    return [provider.profile_id, profile.full_name || profile.email || 'Nurse'];
  }));
  const restockLinesByRequest = new Map(restockRequestIds.map((id) => [id, []]));
  for (const line of restockLineRows) {
    const item = refs.items.get(line.item_id) || {};
    const variant = line.variant_id ? refs.variants.get(line.variant_id) : null;
    restockLinesByRequest.get(line.restock_request_id)?.push({
      id: line.id,
      itemId: line.item_id,
      variantId: line.variant_id || null,
      itemName: item.name || 'Inventory item',
      variantName: variant?.name || null,
      requestedQuantity: asString(line.requested_quantity),
    });
  }
  const assignedItemIds = new Set(balances.map((row) => row.item_id));
  const unstockedItems = allItemRows
    .filter((row) => !assignedItemIds.has(row.id))
    .map((row) => ({
      itemId: row.id,
      variantId: null,
      lotId: null,
      name: row.name,
      variantName: null,
      sku: row.sku || null,
      barcode: row.barcode || null,
      unit: row.unit || 'unit',
      quantityOnHand: '0',
      aggregateQuantityOnHand: '0',
      reorderQuantity: asString(row.reorder_point),
      parQuantity: asString(row.reorder_point),
      parVersion: 0,
      lowStock: true,
      lotCode: null,
      expiresOn: null,
      lastMovementAt: null,
      unitCostCents: '0',
    }));
  return {
    locations,
    catalog: allItemRows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku || null,
      barcode: row.barcode || null,
      qrCode: row.qr_code || null,
      unit: row.unit || 'unit',
      reorderPoint: asString(row.reorder_point),
      tags: row.tags || [],
      status: row.status,
      preferredVendorId: row.preferred_vendor_id || null,
    })),
    variants: allVariantRows.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      name: row.name,
      sku: row.sku || null,
      barcode: row.barcode || null,
      attributes: row.attributes || {},
      unitCostCents: asString(row.unit_cost_cents),
      version: row.version,
    })),
    lots: allLotRows.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      variantId: row.variant_id || null,
      lotCode: row.lot_code || null,
      expiresOn: row.expires_on || null,
      receivedAt: row.received_at || null,
      unitCostCents: asString(row.unit_cost_cents),
    })),
    unstockedItems,
    vendors: vendorRows.map((row) => ({
      id: row.id, name: row.name, status: row.status, version: row.version,
    })),
    purchaseOrders: purchaseOrderRows.map((row) => ({
      id: row.id,
      vendorId: row.vendor_id,
      orderNumber: row.order_number,
      status: row.status,
      expectedOn: row.expected_on,
      subtotalCents: asString(row.subtotal_cents),
      taxCents: asString(row.tax_cents),
      shippingCents: asString(row.shipping_cents),
      version: row.version,
      lines: purchaseOrderLineRows
        .filter((line) => line.purchase_order_id === row.id)
        .map((line) => {
          const item = refs.items.get(line.item_id) || {};
          const variant = line.variant_id ? refs.variants.get(line.variant_id) : null;
          return {
            id: line.id,
            itemId: line.item_id,
            variantId: line.variant_id || null,
            itemName: item.name || 'Inventory item',
            variantName: variant?.name || null,
            quantityOrdered: asString(line.quantity_ordered),
            quantityReceived: asString(line.quantity_received),
            unitCostCents: asString(line.unit_cost_cents),
          };
        }),
    })),
    restockRequests: restockRows.map((request) => ({
      id: request.id,
      locationId: request.location_id,
      locationName: locationsById.get(request.location_id)?.name || 'Nurse kit',
      nurseProfileId: request.nurse_profile_id,
      nurseName: nurseNameByProfileId.get(request.nurse_profile_id) || 'Assigned nurse',
      status: request.status,
      reasonCode: request.reason_code,
      requestedAt: request.requested_at,
      fulfilledAt: request.fulfilled_at,
      fulfillmentReference: request.fulfillment_reference || null,
      fulfillmentTransferGroupId: request.fulfillment_transfer_group_id || null,
      lastTransitionReasonCode: request.last_transition_reason_code || null,
      version: request.version,
      lines: restockLinesByRequest.get(request.id) || [],
    })),
    nurses: providerRows.map((provider) => {
      const profile = nurseProfiles.get(provider.profile_id) || {};
      return {
        providerProfileId: provider.id,
        profileId: provider.profile_id,
        displayName: profile.full_name || profile.email || 'Nurse',
        email: profile.email || null,
        providerRole: provider.provider_role,
        credentialStatus: provider.credential_status,
      };
    }),
  };
}

export async function loadNurseKit(db, tenantId, nurseProfileId, providerProfileId) {
  const assignmentResult = await db.from('os_inventory_location_assignments')
    .select('id,location_id,assignment_status,is_primary,assigned_at,accepted_at,version')
    .eq('tenant_id', tenantId)
    .eq('provider_profile_id', providerProfileId)
    .eq('nurse_profile_id', nurseProfileId)
    .in('assignment_status', ['assigned', 'accepted'])
    .eq('is_primary', true)
    .order('id')
    .limit(2);
  if (assignmentResult.error) throw assignmentResult.error;
  if ((assignmentResult.data || []).length > 1) {
    const error = new Error('Multiple active kit assignments require administrator review.');
    error.code = 'nurse_kit_assignment_ambiguous';
    throw error;
  }
  const assignment = assignmentResult.data?.[0];
  if (!assignment) return { assigned: false, location: null, items: [], restockRequests: [] };
  const locationResult = await db.from('os_inventory_locations')
    .select('id,location_code,name,status,version')
    .eq('tenant_id', tenantId)
    .eq('id', assignment.location_id)
    .eq('location_type', 'nurse_kit')
    .neq('status', 'retired')
    .maybeSingle();
  if (locationResult.error) throw locationResult.error;
  if (!locationResult.data) return { assigned: false, location: null, items: [], restockRequests: [] };
  const location = locationResult.data;
  const [balances, parRows, openRestockRows, restockHistoryRows] = await Promise.all([
    readPaged(() => db.from('os_inventory_location_balances')
      .select('location_id,item_id,variant_id,lot_id,quantity_on_hand,last_movement_at')
      .eq('tenant_id', tenantId).eq('location_id', location.id)
      .order('item_id').order('variant_id', { nullsFirst: true }).order('lot_id', { nullsFirst: true }), {
      label: 'Nurse kit balances', maxRows: READ_LIMITS.nurseKitRows,
    }),
    readPaged(() => db.from('os_inventory_location_par_levels')
      .select('item_id,variant_id,par_quantity,reorder_quantity,version')
      .eq('tenant_id', tenantId).eq('location_id', location.id)
      .order('item_id').order('variant_id', { nullsFirst: true }), {
      label: 'Nurse kit par levels', maxRows: READ_LIMITS.nurseKitRows,
    }),
    // Open requests are isolated from history so an actionable request cannot
    // be pushed out of a recent-results window by older completed work.
    readPaged(() => db.from('os_inventory_restock_requests')
      .select('id,status,reason_code,requested_at,fulfilled_at,version')
      .eq('tenant_id', tenantId).eq('location_id', location.id)
      .eq('nurse_profile_id', nurseProfileId)
      .in('status', ['requested', 'approved', 'packing'])
      .order('requested_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Open nurse kit restock requests', maxRows: READ_LIMITS.nurseOpenRestocks,
    }),
    readPaged(() => db.from('os_inventory_restock_requests')
      .select('id,status,reason_code,requested_at,fulfilled_at,version')
      .eq('tenant_id', tenantId).eq('location_id', location.id)
      .eq('nurse_profile_id', nurseProfileId)
      .in('status', ['fulfilled', 'rejected', 'cancelled'])
      .order('requested_at', { ascending: false }).order('id', { ascending: false }), {
      label: 'Nurse kit restock history', maxRows: READ_LIMITS.nurseRestockHistory,
    }),
  ]);
  const restockRows = [...openRestockRows, ...restockHistoryRows]
    .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)) || String(b.id).localeCompare(String(a.id)));
  const restockLineRows = await readByIds(restockRows.map((row) => row.id), (ids) => db
    .from('os_inventory_restock_request_lines')
    .select('id,restock_request_id,item_id,variant_id,requested_quantity')
    .eq('tenant_id', tenantId).in('restock_request_id', ids)
    .order('restock_request_id').order('id'), {
    label: 'Nurse kit restock request lines', maxRows: READ_LIMITS.restockLines,
  });
  const restockLinesByRequest = new Map(restockRows.map((row) => [row.id, []]));
  for (const line of restockLineRows) restockLinesByRequest.get(line.restock_request_id)?.push(line);
  for (const request of openRestockRows) {
    if ((restockLinesByRequest.get(request.id) || []).length !== 1) {
      const error = new Error('An open kit restock request has an invalid item line and requires administrator review.');
      error.code = 'nurse_restock_line_invalid';
      throw error;
    }
  }
  const refs = await loadInventoryReferences(db, tenantId, balances);
  const parMap = new Map(parRows.map((row) => [
    `${row.item_id}:${row.variant_id || ''}`,
    row,
  ]));
  const aggregateByItem = new Map();
  for (const balance of balances) {
    const key = `${balance.item_id}:${balance.variant_id || ''}`;
    aggregateByItem.set(key, Number(aggregateByItem.get(key) || 0) + Number(balance.quantity_on_hand || 0));
  }
  const items = balances
    .map((balance) => itemLine(
      balance,
      refs,
      parMap.get(`${balance.item_id}:${balance.variant_id || ''}`),
      {
        aggregateQuantity: aggregateByItem.get(`${balance.item_id}:${balance.variant_id || ''}`) || 0,
        includeCost: false,
      },
    ))
    .sort((a, b) => Number(b.lowStock) - Number(a.lowStock) || a.name.localeCompare(b.name));
  return {
    assigned: true,
    location: {
      id: location.id,
      code: location.location_code,
      name: location.name,
      status: location.status,
      version: location.version,
      assignmentStatus: assignment.assignment_status,
      assignmentVersion: assignment.version,
      itemLineCount: items.length,
      lowStockCount: new Set(items.filter((row) => row.lowStock).map((row) => `${row.itemId}:${row.variantId || ''}`)).size,
      expiringCount: items.filter((row) => row.expiresOn && Date.parse(`${row.expiresOn}T00:00:00Z`) <= Date.now() + 30 * 86400000).length,
    },
    items,
    restockRequests: restockRows.map((request) => {
      const line = (restockLinesByRequest.get(request.id) || [])[0] || {};
      return {
        id: request.id,
        status: request.status,
        reason_code: request.reason_code,
        requested_at: request.requested_at,
        fulfilled_at: request.fulfilled_at,
        version: request.version,
        itemId: line.item_id || null,
        variantId: line.variant_id || null,
        requestedQuantity: line.requested_quantity === undefined ? null : asString(line.requested_quantity),
      };
    }),
  };
}
