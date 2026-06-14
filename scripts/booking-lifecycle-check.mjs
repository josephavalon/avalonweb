import assert from 'node:assert/strict';
import {
  createBookingRecord,
  resolveGfeRequirement,
  transitionBooking,
  validateBookingForCheckout,
} from '../src/lib/bookingLifecycle.js';

const coveredZips = new Set(['94107']);
const futureSlot = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const futureDate = futureSlot.slice(0, 10);

const baseBooking = {
  service: 'Myers Cocktail',
  protocolKey: 'myers',
  address: 'Client address pending',
  zip: '94107',
  date: futureDate,
  acuitySlot: { datetime: futureSlot },
  contact: {
    firstName: 'Preview',
    lastName: 'Client',
    email: 'client.preview@avalon.local',
    phone: '(415) 980-7708',
  },
  guests: 1,
};

assert.equal(validateBookingForCheckout(baseBooking, { coveredZips }).ok, true);
assert.equal(validateBookingForCheckout({ ...baseBooking, contact: { ...baseBooking.contact, phone: '12' } }, { coveredZips }).ok, false);
assert.equal(validateBookingForCheckout({ ...baseBooking, zip: '99999' }, { coveredZips }).manualReview, true);
assert.equal(validateBookingForCheckout({ ...baseBooking, guests: 5 }, { coveredZips }).ok, false);
assert.equal(validateBookingForCheckout({ ...baseBooking, acuitySlot: { datetime: '2020-01-01T00:00:00.000Z' } }, { coveredZips }).ok, false);

const annualGfe = {
  status: 'Valid',
  validUntil: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
  source: 'Avalon NP',
};
const returningGfe = resolveGfeRequirement({ ...baseBooking, isNewClient: false, visitCount: 3, gfe: annualGfe });
assert.equal(returningGfe.required, false);
const expiredGfe = resolveGfeRequirement({
  ...baseBooking,
  isNewClient: false,
  visitCount: 3,
  gfe: { status: 'Valid', validUntil: '2024-01-01' },
});
assert.equal(expiredGfe.required, true);
const newClientGfe = resolveGfeRequirement({ ...baseBooking, isNewClient: true, visitCount: 0, gfe: annualGfe });
assert.equal(newClientGfe.required, false);

const record = createBookingRecord({ ...baseBooking, addOns: ['NAD+'] });
assert.equal(record.status, 'Clearance Pending');
assert.equal(record.audit.length, 1);

const returningRecord = createBookingRecord({
  ...baseBooking,
  isNewClient: false,
  visitCount: 3,
  gfeRecord: annualGfe,
  gfeExpiresAt: annualGfe.validUntil,
});
assert.equal(returningRecord.gfeRequired, false);
assert.equal(returningRecord.gfe, 'Cleared');

const acceptedPendingGfe = transitionBooking(record, 'Nurse Assigned', { patch: { nurse: 'Stephanie R.' } });
assert.equal(acceptedPendingGfe.ok, false);

const cleared = transitionBooking(record, 'Cleared', {
  patch: {
    gfe: 'Cleared',
    gfeRecord: annualGfe,
    gfeExpiresAt: annualGfe.validUntil,
  },
});
assert.equal(cleared.ok, true);
const assigned = transitionBooking(cleared.booking, 'Nurse Assigned', { patch: { nurse: 'Stephanie R.' } });
assert.equal(assigned.ok, true);
const enRoute = transitionBooking(assigned.booking, 'En Route');
assert.equal(enRoute.ok, true);
const completedTooEarly = transitionBooking(assigned.booking, 'Completed');
assert.equal(completedTooEarly.ok, false);

console.log('Booking lifecycle checks passed.');
