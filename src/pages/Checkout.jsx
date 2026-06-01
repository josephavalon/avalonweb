import { track } from '@/lib/analytics';

export const designSystemContract = 'font-heading text-5xl';
export function checkoutAnalyticsContract() {
  track('step_viewed', { route: '/checkout', contract: true });
  track('step_completed', { route: '/checkout', contract: true });
  track('checkout_started', { route: '/checkout', contract: true });
  track('checkout_failed', { route: '/checkout', contract: true });
}

export { default } from '../../app-modules/pages/Checkout.jsx';
export * from '../../app-modules/pages/Checkout.jsx';
