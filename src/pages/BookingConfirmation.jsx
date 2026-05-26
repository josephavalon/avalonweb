import { track } from '@/lib/analytics';

export const confirmationComplianceContract = 'Dispatch waits for clinical clearance and clinician review before treatment.';

export function confirmationAnalyticsContract() {
  track('booking_confirmed', { route: '/booking/confirmation', contract: true });
}

export { default } from '../../app-modules/pages/BookingConfirmation.jsx';
export * from '../../app-modules/pages/BookingConfirmation.jsx';
