/**
 * Read-only compatibility hook for the retired standalone inventory module.
 * Canonical inventory writes are accepted only by authenticated semantic API
 * commands; this browser module never writes database tables directly.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasSupabase, supabase } from '../../../src/lib/supabase';

const EMPTY_SETTINGS = Object.freeze({
  orgName: 'Avalon Vitality', currency: 'USD', lowThreshold: 'auto',
  idPrefix: 'AV', idCounter: 0, emailAlerts: false, alertEmail: '',
});

function shapeItem(row) {
  return {
    id: row.id,
    sortlyId: row.sku || row.id,
    name: row.name || 'Inventory item',
    sku: row.sku || '',
    category: Array.isArray(row.tags) ? row.tags[0] || '' : '',
    folderId: row.folder_id || null,
    qty: Number(row.quantityOnHand || 0),
    unit: row.unit || 'unit',
    minLevel: Number(row.reorder_point || 0),
    price: 0,
    supplier: '',
    expirationDate: null,
    refrigeration: false,
    notes: 'Managed by Connected Inventory',
    isNew: false,
    alertEnabled: false,
    deletedAt: null,
    tags: row.tags || [],
    updatedAt: row.updated_at ? row.updated_at.slice(0, 10) : null,
  };
}

export function useInventoryData() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState(hasSupabase ? 'loading' : 'unavailable');
  const [backendError, setBackendError] = useState(hasSupabase ? '' : 'The live inventory source is not configured.');
  const [toasts, setToasts] = useState([]);
  const loadingRef = useRef(false);

  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((previous) => [...previous, { id, msg, type }]);
    setTimeout(() => setToasts((previous) => previous.filter((entry) => entry.id !== id)), 3500);
  }, []);
  const dismissToast = useCallback((id) => setToasts((previous) => previous.filter((entry) => entry.id !== id)), []);

  const loadAll = useCallback(async () => {
    if (loadingRef.current || !hasSupabase) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Admin sign-in is required.');
      const response = await fetch('/api/admin/inventory', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Inventory is unavailable.');
      const quantities = new Map();
      for (const location of payload.data?.locations || []) {
        for (const line of location.items || []) quantities.set(line.itemId, (quantities.get(line.itemId) || 0) + Number(line.quantityOnHand || 0));
      }
      setItems((payload.data?.catalog || []).map((row) => shapeItem({ ...row, quantityOnHand: quantities.get(row.id) || 0 })));
      setBackendStatus('ready');
      setBackendError('');
    } catch (error) {
      setItems([]);
      setBackendStatus('unavailable');
      setBackendError(error?.message || 'Inventory is unavailable.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabase) { setLoading(false); return; }
    loadAll();
  }, [loadAll]);

  const mutationUnavailable = useCallback(async () => {
    toast('Use Admin Inventory. Direct browser inventory changes are disabled.', 'error');
    return null;
  }, [toast]);

  return {
    items,
    folders: [],
    tags: [],
    trashedItems: [],
    settings: EMPTY_SETTINGS,
    customFieldDefs: [],
    loading,
    backendStatus,
    backendError,
    toasts,
    dismissToast,
    handleAddItem: mutationUnavailable,
    handleSaveItem: mutationUnavailable,
    handleUpdateQty: mutationUnavailable,
    handleDeleteItem: mutationUnavailable,
    handleRestoreItem: mutationUnavailable,
    handleDeletePermanent: mutationUnavailable,
    handleBulkDelete: mutationUnavailable,
    handleBulkMove: mutationUnavailable,
    handleAddFolder: mutationUnavailable,
    handleEditFolder: mutationUnavailable,
    handleDeleteFolder: mutationUnavailable,
    handleAddTag: mutationUnavailable,
    handleEditTag: mutationUnavailable,
    handleDeleteTag: mutationUnavailable,
    handleAddFieldDef: mutationUnavailable,
    handleEditFieldDef: mutationUnavailable,
    handleDeleteFieldDef: mutationUnavailable,
    handleUpdateSettings: mutationUnavailable,
    fetchItemTransactions: async () => [],
    refreshAll: loadAll,
    isLive: backendStatus === 'ready',
  };
}
