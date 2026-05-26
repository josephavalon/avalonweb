import { Check, CreditCard, MapPin, User } from 'lucide-react';

export const CHECKOUT_EASE = [0.16, 1, 0.3, 1];
export const CHECKOUT_TIMEZONE = 'America/Los_Angeles';
export const CHECKOUT_STEPS = ['Review', 'Appointment', 'Contact', 'Reserve'];
export const CHECKOUT_STEP_ICONS = [Check, MapPin, User, CreditCard];

export function formatCheckoutTimeLabel(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: CHECKOUT_TIMEZONE,
  });
}

export function todayCheckoutString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: CHECKOUT_TIMEZONE });
}
