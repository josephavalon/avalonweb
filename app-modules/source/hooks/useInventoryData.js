/**
 * useInventoryData — full persistence layer for AdminInventory
 *
 * When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, all reads/writes
 * go to Supabase with optimistic UI + rollback on error.
 *
 * When creds are absent (local dev without .env.local), the hook falls back
 * to SEED_* data so the UI still renders. No code changes needed to switch.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, hasSupabase } from '../../../src/lib/supabase';
import {
  SEED_ITEMS,
  SEED_FOLDERS,
  SEED_TAGS,
  DEFAULT_SETTINGS,
} from '../../../src/data/inventorySeed';

// ─── Transforms (camelCase ↔ snake_case) ──────────────────────────────────────

function itemFromDb(row) {
  return {
    id:             row.id,
    sortlyId:       row.sortly_id,
    name:           row.name,
    sku:            row.sku          || '',
    category:       row.category     || '',
    folderId:       row.folder_id    || null,
    qty:            row.qty          ?? 0,
    unit:           row.unit         || 'units',
    minLevel:       row.min_level    ?? 0,
    price:          Number(row.price || 0),
    supplier:       row.supplier     || '',
    expirationDate: row.expiration_date || null,
    refrigeration:  row.refrigeration   || false,
    notes:          row.notes        || '',
    isNew:          row.is_new       || false,
    alertEnabled:   row.alert_enabled || false,
    deletedAt:      row.deleted_at   || null,
    tags:           (row.item_tags || []).map(t => t.tag_id),
    updatedAt:      row.updated_at ? row.updated_at.slice(0, 10) : null,
  };
}

function itemToDb(item) {
  const d = {
    name:            item.name,
    sku:             item.sku             || null,
    category:        item.category        || null,
    folder_id:       item.folderId        || null,
    qty:             item.qty             ?? 0,
    unit:            item.unit            || 'units',
    min_level:       item.minLevel        ?? 0,
    price:           item.price           ?? 0,
    supplier:        item.supplier        || null,
    expiration_date: item.expirationDate  || null,
    refrigeration:   item.refrigeration   || false,
    notes:           item.notes           || null,
    is_new:          item.isNew           ?? true,
    alert_enabled:   item.alertEnabled    || false,
  };
  if (item.id && !String(item.id).startsWith('temp_')) d.id = item.id;
  return d;
}

function folderFromDb(row) {
  return {
    id:        row.id,
    name:      row.name,
    parentId:  row.parent_id  || null,
    color:     row.color      || 'hsl(220 9% 46%)',
    itemCount: row.item_count ?? 0,
    updatedAt: row.updated_at ? row.updated_at.slice(0, 10) : null,
  };
}

function folderToDb(folder) {
  const d = {
    name:      folder.name,
    parent_id: folder.parentId || null,
    color:     folder.color    || 'hsl(220 9% 46%)',
  };
  if (folder.id && !String(folder.id).startsWith('f-temp_')) d.id = folder.id;
  return d;
}

function tagFromDb(row) {
  return { id: row.id, name: row.name, color: row.color || 'hsl(213 94% 68%)' };
}

function settingsFromDb(row) {
  return {
    orgName:      row.org_name           || 'Avalon Vitality',
    currency:     row.currency           || 'USD',
    lowThreshold: row.low_stock_threshold || 'auto',
    idPrefix:     row.id_prefix          || 'AVOT',
    idCounter:    row.id_counter         ?? 22,
    emailAlerts:  row.email_alerts       || false,
    alertEmail:   row.alert_email        || '',
  };
}

const TODAY = () => new Date().toISOString().slice(0, 10);

// ─── Transaction writer ───────────────────────────────────────────────────────

async function writeTx(fields) {
  if (!hasSupabase) return;
  try {
    await supabase.from('transactions').insert([{
      item_id:    fields.itemId    || null,
      item_name:  fields.itemName  || '',
      type:       fields.type,
      qty_before: fields.qtyBefore ?? null,
      qty_after:  fields.qtyAfter  ?? null,
      qty_delta:  (fields.qtyAfter != null && fields.qtyBefore != null)
                    ? fields.qtyAfter - fields.qtyBefore
                    : null,
      folder_from: fields.folderFrom || null,
      folder_to:   fields.folderTo   || null,
      note:        fields.note       || null,
    }]);
  } catch (_) { /* non-fatal — don't block the UI */ }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInventoryData() {
  const [items,           setItems]           = useState([]);
  const [folders,         setFolders]         = useState([]);
  const [tags,            setTags]            = useState([]);
  const [trashedItems,    setTrashedItems]    = useState([]);
  const [settings,        setSettings]        = useState(DEFAULT_SETTINGS);
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [toasts,          setToasts]          = useState([]);

  const loadingRef = useRef(false);

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const toast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadFolders = useCallback(async () => {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { if (import.meta.env?.DEV) console.error('loadFolders', error); return; }

    // Compute item counts client-side after items are loaded
    setFolders(data.map(folderFromDb));
  }, []);

  const loadItems = useCallback(async () => {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from('items')
      .select('*, item_tags(tag_id)')
      .order('created_at', { ascending: true });
    if (error) { if (import.meta.env?.DEV) console.error('loadItems', error); return; }

    setItems(data.filter(r => !r.deleted_at).map(itemFromDb));
    setTrashedItems(data.filter(r => r.deleted_at).map(itemFromDb));
  }, []);

  const loadTags = useCallback(async () => {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });
    if (error) { if (import.meta.env?.DEV) console.error('loadTags', error); return; }
    setTags(data.map(tagFromDb));
  }, []);

  const loadSettings = useCallback(async () => {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error || !data) return;
    setSettings(settingsFromDb(data));
  }, []);

  const loadCustomFieldDefs = useCallback(async () => {
    if (!hasSupabase) return;
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) { if (import.meta.env?.DEV) console.error('loadCustomFieldDefs', error); return; }
    setCustomFieldDefs(data.map(r => ({
      id:        r.id,
      name:      r.name,
      fieldType: r.field_type,
      options:   r.options || [],
      sortOrder: r.sort_order,
    })));
  }, []);

  const loadAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    await Promise.all([loadFolders(), loadItems(), loadTags(), loadSettings(), loadCustomFieldDefs()]);
    setLoading(false);
    loadingRef.current = false;
  }, [loadFolders, loadItems, loadTags, loadSettings, loadCustomFieldDefs]);

  // ── Initial load + realtime ────────────────────────────────────────────────
  useEffect(() => {
    if (!hasSupabase) {
      // Seed fallback: deep-clone so mutations don't corrupt the seed arrays
      setItems(SEED_ITEMS.map(i => ({ ...i, tags: [...(i.tags || [])] })));
      setFolders(SEED_FOLDERS.map(f => ({ ...f })));
      setTags(SEED_TAGS.map(t => ({ ...t })));
      setTrashedItems([]);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    loadAll();

    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' },    () => loadItems())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' },  () => loadFolders())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' },     () => loadTags())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_tags' },() => loadItems())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Recompute folder item counts whenever items change
  useEffect(() => {
    if (!hasSupabase) return;
    setFolders(prev => prev.map(f => ({
      ...f,
      itemCount: items.filter(i => i.folderId === f.id).length,
    })));
  }, [items]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function nextSortlyId(prefix, counter) {
    return `${prefix}${String(counter).padStart(4, '0')}`;
  }

  // ── Item mutations ─────────────────────────────────────────────────────────

  async function handleAddItem(newItem) {
    const tempId = 'temp_' + Date.now();
    const sortlyId = nextSortlyId(settings.idPrefix, settings.idCounter);
    const optimistic = {
      ...newItem, id: tempId, sortlyId,
      isNew: true, updatedAt: TODAY(),
      tags: newItem.tags || [],
    };
    setItems(prev => [...prev, optimistic]);

    if (!hasSupabase) {
      setSettings(prev => ({ ...prev, idCounter: prev.idCounter + 1 }));
      return;
    }

    const { data, error } = await supabase
      .from('items')
      .insert([itemToDb(newItem)])
      .select('*, item_tags(tag_id)')
      .single();

    if (error) {
      setItems(prev => prev.filter(i => i.id !== tempId));
      toast('Failed to save item: ' + error.message, 'error');
      return;
    }

    const saved = itemFromDb(data);
    setItems(prev => prev.map(i => i.id === tempId ? saved : i));

    // Save tag associations
    if (newItem.tags?.length) {
      await supabase.from('item_tags').insert(
        newItem.tags.map(tagId => ({ item_id: saved.id, tag_id: tagId }))
      );
    }

    await writeTx({ type: 'create', itemId: saved.id, itemName: saved.name, qtyAfter: saved.qty });
    // Increment counter
    await supabase.from('settings').update({ id_counter: settings.idCounter + 1 }).eq('id', 1);
    setSettings(prev => ({ ...prev, idCounter: prev.idCounter + 1 }));
    toast(`${saved.name} added`, 'success');
  }

  async function handleSaveItem(updated) {
    const prev = items.find(i => i.id === updated.id) || {};
    // Optimistic
    setItems(prevList => prevList.map(i => i.id === updated.id ? { ...updated, updatedAt: TODAY() } : i));

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('items')
      .update(itemToDb(updated))
      .eq('id', updated.id);

    if (error) {
      setItems(prevList => prevList.map(i => i.id === updated.id ? prev : i));
      toast('Save failed: ' + error.message, 'error');
      return;
    }

    // Sync tags: delete all then reinsert
    await supabase.from('item_tags').delete().eq('item_id', updated.id);
    if (updated.tags?.length) {
      await supabase.from('item_tags').insert(
        updated.tags.map(tagId => ({ item_id: updated.id, tag_id: tagId }))
      );
    }

    const changedFields = Object.keys(updated).filter(k => updated[k] !== prev[k]).join(', ');
    await writeTx({ type: 'edit', itemId: updated.id, itemName: updated.name, note: `Fields changed: ${changedFields}` });
    toast(`${updated.name} saved`, 'success');
  }

  async function handleUpdateQty(id, newQty) {
    const q = Math.max(0, newQty);
    const item = items.find(i => i.id === id);
    if (!item) return;
    const before = item.qty;
    const type   = q > before ? 'check_in' : 'check_out';

    setItems(prev => prev.map(i => i.id === id ? { ...i, qty: q, updatedAt: TODAY() } : i));

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('items')
      .update({ qty: q, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, qty: before } : i));
      toast('Qty update failed', 'error');
      return;
    }

    await writeTx({ type, itemId: id, itemName: item.name, qtyBefore: before, qtyAfter: q });
  }

  async function handleDeleteItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const trashed = { ...item, deletedAt: TODAY() };
    setItems(prev => prev.filter(i => i.id !== id));
    setTrashedItems(prev => [...prev, trashed]);

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      setItems(prev => [...prev, item]);
      setTrashedItems(prev => prev.filter(i => i.id !== id));
      toast('Delete failed', 'error');
      return;
    }

    await writeTx({ type: 'delete', itemId: id, itemName: item.name });
    toast(`${item.name} moved to Trash`, 'info');
  }

  async function handleRestoreItem(id) {
    const item = trashedItems.find(i => i.id === id);
    if (!item) return;
    const { deletedAt: _d, ...restored } = item;
    setTrashedItems(prev => prev.filter(i => i.id !== id));
    setItems(prev => [...prev, { ...restored, deletedAt: null }]);

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('items')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) {
      setItems(prev => prev.filter(i => i.id !== id));
      setTrashedItems(prev => [...prev, item]);
      toast('Restore failed', 'error');
      return;
    }

    await writeTx({ type: 'restore', itemId: id, itemName: item.name });
    toast(`${item.name} restored`, 'success');
  }

  async function handleDeletePermanent(id) {
    if (id === 'all') {
      const allIds = trashedItems.map(i => i.id);
      setTrashedItems([]);
      if (!hasSupabase) return;
      // Filter to only real IDs (not seed placeholders)
      const realIds = allIds.filter(i => !String(i).startsWith('temp_'));
      if (realIds.length) {
        await supabase.from('items').delete().in('id', realIds);
      }
      toast('Trash emptied', 'info');
    } else {
      const item = trashedItems.find(i => i.id === id);
      setTrashedItems(prev => prev.filter(i => i.id !== id));
      if (!hasSupabase) return;
      if (!String(id).startsWith('temp_')) {
        const { error } = await supabase.from('items').delete().eq('id', id);
        if (error) {
          if (item) setTrashedItems(prev => [...prev, item]);
          toast('Permanent delete failed', 'error');
          return;
        }
      }
      toast('Item permanently deleted', 'info');
    }
  }

  async function handleBulkDelete(selectedIds) {
    const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
    const toTrash = items.filter(i => idSet.has(i.id)).map(i => ({ ...i, deletedAt: TODAY() }));
    setItems(prev => prev.filter(i => !idSet.has(i.id)));
    setTrashedItems(prev => [...prev, ...toTrash]);

    if (!hasSupabase) return;

    const realIds = [...idSet].filter(i => !String(i).startsWith('temp_'));
    if (realIds.length) {
      const { error } = await supabase
        .from('items')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', realIds);
      if (error) {
        // Rollback
        toTrash.forEach(i => {
          setTrashedItems(prev => prev.filter(t => t.id !== i.id));
          setItems(prev => [...prev, i]);
        });
        toast('Bulk delete failed', 'error');
        return;
      }
    }

    toast(`${toTrash.length} item${toTrash.length !== 1 ? 's' : ''} moved to Trash`, 'info');
  }

  async function handleBulkMove(selectedIds, destFolderId) {
    const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
    setItems(prev => prev.map(i =>
      idSet.has(i.id)
        ? { ...i, folderId: destFolderId || null, updatedAt: TODAY() }
        : i
    ));

    if (!hasSupabase) return;

    const realIds = [...idSet].filter(i => !String(i).startsWith('temp_'));
    if (realIds.length) {
      const { error } = await supabase
        .from('items')
        .update({ folder_id: destFolderId || null, updated_at: new Date().toISOString() })
        .in('id', realIds);
      if (error) {
        toast('Move failed: ' + error.message, 'error');
        return;
      }
    }

    const count = idSet.size;
    toast(`${count} item${count !== 1 ? 's' : ''} moved`, 'success');
  }

  // ── Folder mutations ───────────────────────────────────────────────────────

  async function handleAddFolder(data) {
    const tempId = 'f-temp_' + Date.now();
    const optimistic = {
      id: tempId, name: data.name, parentId: data.parentId || null,
      color: data.color || 'hsl(220 9% 46%)', itemCount: 0, updatedAt: TODAY(),
    };
    setFolders(prev => [...prev, optimistic]);

    if (!hasSupabase) return;

    const { data: row, error } = await supabase
      .from('folders')
      .insert([folderToDb(data)])
      .select()
      .single();

    if (error) {
      setFolders(prev => prev.filter(f => f.id !== tempId));
      toast('Failed to create folder', 'error');
      return;
    }

    setFolders(prev => prev.map(f => f.id === tempId ? folderFromDb(row) : f));
    toast(`Folder "${row.name}" created`, 'success');
  }

  async function handleEditFolder(updated) {
    setFolders(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f));

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('folders')
      .update({ name: updated.name, color: updated.color, parent_id: updated.parentId || null })
      .eq('id', updated.id);

    if (error) {
      toast('Folder update failed', 'error');
      loadFolders(); // refresh
    }
  }

  async function handleDeleteFolder(id) {
    setFolders(prev => prev.filter(f => f.id !== id));

    if (!hasSupabase) return;

    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) {
      toast('Folder delete failed', 'error');
      loadFolders();
    }
  }

  // ── Tag mutations ──────────────────────────────────────────────────────────

  async function handleAddTag(tag) {
    const tempId = 'tag-temp_' + Date.now();
    const optimistic = { id: tempId, name: tag.name, color: tag.color || 'hsl(213 94% 68%)' };
    setTags(prev => [...prev, optimistic]);

    if (!hasSupabase) return;

    const { data, error } = await supabase
      .from('tags')
      .insert([{ name: tag.name, color: tag.color || 'hsl(213 94% 68%)' }])
      .select()
      .single();

    if (error) {
      setTags(prev => prev.filter(t => t.id !== tempId));
      toast('Failed to create tag', 'error');
      return;
    }

    setTags(prev => prev.map(t => t.id === tempId ? tagFromDb(data) : t));
  }

  async function handleEditTag(tag) {
    setTags(prev => prev.map(t => t.id === tag.id ? tag : t));

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('tags')
      .update({ name: tag.name, color: tag.color })
      .eq('id', tag.id);

    if (error) { toast('Tag update failed', 'error'); loadTags(); }
  }

  async function handleDeleteTag(id) {
    setTags(prev => prev.filter(t => t.id !== id));
    // Remove tag from all items in local state
    setItems(prev => prev.map(i => ({
      ...i,
      tags: (i.tags || []).filter(tid => tid !== id),
    })));

    if (!hasSupabase) return;

    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) { toast('Tag delete failed', 'error'); loadTags(); }
  }

  // ── Custom field definition mutations ─────────────────────────────────────

  async function handleAddFieldDef(def) {
    const tempId = 'cfd-temp_' + Date.now();
    const optimistic = {
      id: tempId,
      name: def.name,
      fieldType: def.fieldType,
      options: def.options || [],
      sortOrder: customFieldDefs.length,
    };
    setCustomFieldDefs(prev => [...prev, optimistic]);

    if (!hasSupabase) return;

    const { data, error } = await supabase
      .from('custom_field_definitions')
      .insert([{
        name:       def.name,
        field_type: def.fieldType,
        options:    def.options?.length ? def.options : null,
        sort_order: customFieldDefs.length,
      }])
      .select()
      .single();

    if (error) {
      setCustomFieldDefs(prev => prev.filter(f => f.id !== tempId));
      toast('Failed to create field', 'error');
      return;
    }

    setCustomFieldDefs(prev => prev.map(f => f.id === tempId ? {
      id: data.id, name: data.name, fieldType: data.field_type,
      options: data.options || [], sortOrder: data.sort_order,
    } : f));
  }

  async function handleEditFieldDef(id, updates) {
    setCustomFieldDefs(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('custom_field_definitions')
      .update({
        name:       updates.name,
        field_type: updates.fieldType,
        options:    updates.options?.length ? updates.options : null,
      })
      .eq('id', id);

    if (error) { toast('Field update failed', 'error'); loadCustomFieldDefs(); }
  }

  async function handleDeleteFieldDef(id) {
    setCustomFieldDefs(prev => prev.filter(f => f.id !== id));

    if (!hasSupabase) return;

    const { error } = await supabase
      .from('custom_field_definitions')
      .delete()
      .eq('id', id);

    if (error) { toast('Field delete failed', 'error'); loadCustomFieldDefs(); }
  }

  // ── Settings mutation ──────────────────────────────────────────────────────

  async function handleUpdateSettings(newSettings) {
    setSettings(prev => ({ ...prev, ...newSettings }));

    if (!hasSupabase) return;

    const { error } = await supabase.from('settings').update({
      org_name:            newSettings.orgName      ?? settings.orgName,
      currency:            newSettings.currency     ?? settings.currency,
      low_stock_threshold: newSettings.lowThreshold ?? settings.lowThreshold,
      email_alerts:        newSettings.emailAlerts  ?? settings.emailAlerts,
      alert_email:         newSettings.alertEmail   ?? settings.alertEmail,
      updated_at:          new Date().toISOString(),
    }).eq('id', 1);

    if (error) { toast('Settings save failed', 'error'); return; }
    toast('Settings saved', 'success');
  }

  // ── Fetch activity history for an item ────────────────────────────────────

  async function fetchItemTransactions(itemId) {
    if (!hasSupabase) return [];
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return [];
    return data.map(r => ({
      id:         r.id,
      type:       r.type,
      qtyBefore:  r.qty_before,
      qtyAfter:   r.qty_after,
      qtyDelta:   r.qty_delta,
      folderFrom: r.folder_from,
      folderTo:   r.folder_to,
      note:       r.note,
      userName:   r.user_name || 'System',
      createdAt:  r.created_at,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  return {
    // State
    items,
    folders,
    tags,
    trashedItems,
    settings,
    customFieldDefs,
    loading,
    toasts,
    dismissToast,

    // Item handlers
    handleAddItem,
    handleSaveItem,
    handleUpdateQty,
    handleDeleteItem,
    handleRestoreItem,
    handleDeletePermanent,
    handleBulkDelete,
    handleBulkMove,

    // Folder handlers
    handleAddFolder,
    handleEditFolder,
    handleDeleteFolder,

    // Tag handlers
    handleAddTag,
    handleEditTag,
    handleDeleteTag,

    // Custom field definition handlers
    handleAddFieldDef,
    handleEditFieldDef,
    handleDeleteFieldDef,

    // Settings
    handleUpdateSettings,

    // Queries
    fetchItemTransactions,

    // Utilities
    refreshAll: loadAll,
    isLive: hasSupabase,
  };
}
