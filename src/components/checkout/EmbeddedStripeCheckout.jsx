import React, { useMemo, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';

// Cache loadStripe() so we don't refetch Stripe.js on every re-render.
let cachedStripePromise = null;
function getStripePromise() {
  if (cachedStripePromise) return cachedStripePromise;
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  cachedStripePromise = loadStripe(key);
  return cachedStripePromise;
}

/**
 * Inline Stripe Embedded Checkout — takes a Session client_secret produced by
 * api/create-checkout-session.js with `checkoutUiMode: 'embedded'`. Renders the
 * card field + line-items + total in the page (no redirect). On success Stripe
 * redirects to the session's return_url. Same webhook path as hosted Checkout,
 * so BookNow / PlanCheckout fulfillment code stays unchanged.
 *
 * Props:
 *   clientSecret — from POST /api/create-checkout-session (embedded mode)
 *   onComplete   — optional callback when Stripe reports checkout complete
 */
export default function EmbeddedStripeCheckout({ clientSecret, onComplete }) {
  const stripePromise = useMemo(getStripePromise, []);
  const options = useMemo(() => (clientSecret ? {
    clientSecret,
    onComplete,
  } : null), [clientSecret, onComplete]);

  const fetchClientSecret = useCallback(() => Promise.resolve(clientSecret), [clientSecret]);

  if (!stripePromise) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 font-body text-sm text-red-200">
        Payments unavailable — VITE_STRIPE_PUBLISHABLE_KEY is not configured for this environment.
      </p>
    );
  }
  if (!clientSecret) return null;

  return (
    <div className="rounded-[1.35rem] border border-foreground/12 bg-background/40 p-2 md:p-3">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ ...options, fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
