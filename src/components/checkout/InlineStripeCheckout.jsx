import React, { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { ArrowRight } from 'lucide-react';

// Cache the loadStripe() promise so we don't re-issue Stripe.js downloads on
// every re-render. Reads the publishable key from Vite env — MUST be set on
// Vercel Preview and Production for inline checkout to load.
let cachedStripePromise = null;
function getStripePromise() {
  if (cachedStripePromise) return cachedStripePromise;
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  cachedStripePromise = loadStripe(key);
  return cachedStripePromise;
}

// Dark editorial appearance to match the site — Bebas headings elsewhere are
// canvas-level; here inputs need to read like the rest of the glass surfaces.
const APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#ffffff',
    colorBackground: 'rgba(255,255,255,0.04)',
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255,255,255,0.6)',
    colorDanger: '#ff6b6b',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSizeBase: '15px',
    spacingUnit: '4px',
    borderRadius: '12px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid rgba(255,255,255,0.55)',
      boxShadow: 'none',
    },
    '.Label': {
      fontWeight: '600',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      fontSize: '11px',
      color: 'rgba(255,255,255,0.55)',
    },
  },
};

function PayButton({ label, disabled, loading }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="group mt-5 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 font-body text-sm uppercase tracking-[0.22em] text-background transition-colors hover:bg-foreground/90 disabled:opacity-45 disabled:cursor-not-allowed"
    >
      {loading ? 'Processing…' : label}
      {!loading && <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" strokeWidth={2} />}
    </button>
  );
}

function InlineForm({ returnUrl, submitLabel, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setErrorMsg('');
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    // If confirmPayment succeeds it redirects; only errors return here.
    if (error) {
      const message = error.message || 'Payment failed. Please try another card.';
      setErrorMsg(message);
      onError?.(error);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          // Cards only — matches the hosted Checkout config; Link + wallets stay off.
          wallets: { applePay: 'never', googlePay: 'never' },
          fields: { billingDetails: { address: { country: 'never' } } },
        }}
      />
      {errorMsg && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-body text-sm text-red-200">
          {errorMsg}
        </p>
      )}
      <PayButton label={submitLabel} disabled={!stripe || loading} loading={loading} />
    </form>
  );
}

/**
 * Inline Stripe Elements checkout.
 * Props:
 *   clientSecret  — PaymentIntent client_secret from the server
 *   returnUrl     — absolute URL Stripe redirects to after 3DS / on success
 *   submitLabel   — Bebas-tracked button label ("Reserve — $149")
 *   onError       — optional callback fired when confirmPayment returns an error
 */
export default function InlineStripeCheckout({ clientSecret, returnUrl, submitLabel = 'Pay now', onError }) {
  const stripePromise = useMemo(getStripePromise, []);

  if (!stripePromise) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 font-body text-sm text-red-200">
        Payments unavailable — VITE_STRIPE_PUBLISHABLE_KEY is not configured for this environment.
      </p>
    );
  }
  if (!clientSecret) return null;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
      <InlineForm returnUrl={returnUrl} submitLabel={submitLabel} onError={onError} />
    </Elements>
  );
}
