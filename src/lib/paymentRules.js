export const ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS = 50;
export const EVENT_UPFRONT_FRACTION = 0.5;

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

export function calculateLaunchPayment({
  subtotal = 0,
  visitType = 'single',
  orderType = '',
  subscriptionPrice = 0,
  isGroupVisit = false,
  hasKnownPrice = true,
} = {}) {
  const total = money(subtotal);
  const normalizedVisit = String(visitType || '').toLowerCase();
  const normalizedOrder = String(orderType || '').toLowerCase();
  const subscription = normalizedVisit === 'subscription' || normalizedOrder === 'subscription';
  const event = isGroupVisit || normalizedVisit === 'event' || normalizedOrder === 'event';

  if (subscription) {
    // Plan signups bill like a one-time visit: a flat $50 deposit today, the
    // remainder of the first month collected after the first visit, and the
    // recurring full-price subscription starts one period later (created in
    // fulfillment). We never charge the whole month up front.
    const monthly = money(subscriptionPrice || total);
    const dueNow = Math.min(ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS, monthly);
    return {
      subtotal: monthly,
      depositAmount: money(dueNow),
      balanceDue: money(monthly - dueNow),
      paymentType: 'subscription_deposit_first_month',
      paymentStatus: monthly > dueNow ? 'partial_payment' : 'paid_in_full',
    };
  }

  if (event) {
    if (!hasKnownPrice || total <= 0) {
      return {
        subtotal: total,
        depositAmount: 0,
        balanceDue: total,
        paymentType: 'event_quote_required',
        paymentStatus: 'quote_required',
      };
    }
    const dueNow = money(total * EVENT_UPFRONT_FRACTION);
    return {
      subtotal: total,
      depositAmount: dueNow,
      balanceDue: money(total - dueNow),
      paymentType: 'event_half_upfront',
      paymentStatus: 'partial_payment',
    };
  }

  const dueNow = Math.min(ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS, total);
  return {
    subtotal: total,
    depositAmount: money(dueNow),
    balanceDue: money(total - dueNow),
    paymentType: 'one_time_deposit',
    paymentStatus: total > dueNow ? 'partial_payment' : 'paid_in_full',
  };
}
