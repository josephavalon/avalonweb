import { track } from '@/lib/analytics';

export const designSystemContract = 'font-heading text-5xl';
export const bookingComplianceContract = 'Clinical clearance is required before treatment and final service is subject to clinical approval.';
export function bookingAnalyticsContract() {
  track('step_viewed', { route: '/book', contract: true });
  track('step_completed', { route: '/book', contract: true });
  track('checkout_started', { route: '/book', contract: true });
  track('checkout_failed', { route: '/book', contract: true });
}

export { default } from '../../app-modules/pages/BookNow.jsx';
export * from '../../app-modules/pages/BookNow.jsx';
