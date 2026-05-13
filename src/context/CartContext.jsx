import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CartContext = createContext(null);

function readLocalCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('av_cart');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  // One-time purchase items
  const [items, setItems] = useState(() => readLocalCart());
  // Membership subscription (only one at a time)
  const [membership, setMembership] = useState(null);
  // Acuity appointment slot (set during checkout AppointmentStep)
  // Shape: { appointmentTypeID, datetime, date, timeLabel, timezone }
  const [appointment, setAppointmentState] = useState(null);

  // Persist items to localStorage on every change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('av_cart', JSON.stringify(items));
    } catch {}
  }, [items]);

  const addItem = useCallback((item) => {
    // item shape: { cartKey, label, price, type: 'iv'|'im' }
    setItems((prev) =>
      prev.find((i) => i.cartKey === item.cartKey) ? prev : [...prev, item]
    );
  }, []);

  const removeItem = useCallback((cartKey) => {
    setItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
  }, []);

  const clearItems = useCallback(() => setItems([]), []);

  const setMembershipTier = useCallback((tier) => {
    // tier shape: { name, billing: 'monthly'|'annual', price, ivCount, stripePriceId }
    setMembership(tier);
  }, []);

  const clearMembership = useCallback(() => setMembership(null), []);

  const setAppointment = useCallback((slot) => {
    // slot: { appointmentTypeID, datetime, date, timeLabel, timezone }
    setAppointmentState(slot);
  }, []);

  const clearAppointment = useCallback(() => setAppointmentState(null), []);

  const itemsTotal = items.reduce((sum, i) => sum + i.price, 0);
  const totalCount = items.length + (membership ? 1 : 0);

  return (
    <CartContext.Provider value={{
      items,
      membership,
      appointment,
      addItem,
      removeItem,
      clearItems,
      setMembershipTier,
      clearMembership,
      setAppointment,
      clearAppointment,
      itemsTotal,
      totalCount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
