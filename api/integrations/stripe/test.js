import { isLiveApiEnabled } from '../../_lib/pre-api-guard.js';
import { requireAdmin } from '../../_lib/supabase-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configured = Boolean(process.env.STRIPE_SECRET_KEY);
  if (!isLiveApiEnabled()) {
    return res.status(200).json({
      ok: false,
      connected: false,
      provider: 'stripe',
      configured,
      hasPublishableKey: Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY),
      mode: 'local-simulation-only',
      preApiHardWall: true,
      routes: ['/api/create-checkout-session'],
      missing: configured ? [] : ['STRIPE_SECRET_KEY'],
    });
  }

  const authed = await requireAdmin(req, res);
  if (!authed) return;

  return res.status(200).json({
    ok: configured,
    connected: configured,
    provider: 'stripe',
    configured,
    hasPublishableKey: Boolean(process.env.VITE_STRIPE_PUBLISHABLE_KEY),
    mode: configured ? 'checkout-ready' : 'missing-secret',
    routes: ['/api/create-checkout-session'],
    missing: configured ? [] : ['STRIPE_SECRET_KEY'],
  });
}
