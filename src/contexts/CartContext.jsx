import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const CartContext = createContext(null);

const STORAGE_KEY = 'avalon.cart.v1';

const safeParse = (raw) => {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
};

// Each cart line has a stable cartId so the same treatment can appear with different
// configurations (e.g. Hydration with boots vs without). productId is the catalog id.
const newCartId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    if (typeof window === 'undefined') return [];
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  });

  // Persist on every change
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const addItem = useCallback((item) => {
    setItems(prev => [...prev, { cartId: newCartId(), qty: 1, ...item }]);
  }, []);

  const removeItem = useCallback((cartId) => {
    setItems(prev => prev.filter(i => i.cartId !== cartId));
  }, []);

  const updateQty = useCallback((cartId, qty) => {
    const clamped = Math.max(1, Math.min(25, Math.round(qty || 1)));
    setItems(prev => prev.map(i => i.cartId === cartId ? { ...i, qty: clamped } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0), [items]);
  const totalItems = useMemo(() => items.reduce((sum, i) => sum + (i.qty || 1), 0), [items]);

  const value = useMemo(() => ({
    items, subtotal, totalItems,
    addItem, removeItem, updateQty, clearCart,
  }), [items, subtotal, totalItems, addItem, removeItem, updateQty, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
