import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CartContext = createContext(null);

function readLocalCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('av_cart');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[cart-read]', err);
    return [];
  }
}

function readLocalMembership() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('av_membership');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[membership-read]', err);
    return null;
  }
}

export function CartProvider({ children }) {
  // One-time purchase items
  const [items, setItems] = useState(() => readLocalCart());
  // Membership subscription (only one at a time)
  const [membership, setMembership] = useState(() => readLocalMembership());
  // Appointment slot (set during checkout AppointmentStep)
  // Shape: { appointmentTypeID, datetime, date, timeLabel, timezone }
  const [appointment, setAppointmentState] = useState(null);

  // Persist items to localStorage on every change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('av_cart', JSON.stringify(items));
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[cart-write]', err);
    }
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (membership) {
        localStorage.setItem('av_membership', JSON.stringify(membership));
      } else {
        localStorage.removeItem('av_membership');
      }
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[membership-write]', err);
    }
  }, [membership]);

  const addItem = useCallback((item) => {
    // item shape: { cartKey, label, price, quantity?, type: 'iv'|'im'|'addon', personId?, personLabel? }
    setItems((prev) =>
      prev.find((i) => i.cartKey === item.cartKey) ? prev : [...prev, item]
    );
  }, []);

  const removeItem = useCallback((cartKey) => {
    setItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
  }, []);

  const removePerson = useCallback((personId) => {
    if (!personId) return;
    setItems((prev) => prev.filter((i) => i.personId !== personId));
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

  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
  const totalCount = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0) + (membership ? 1 : 0);

  return (
    <CartContext.Provider value={{
      items,
      membership,
      appointment,
      addItem,
      removeItem,
      removePerson,
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
