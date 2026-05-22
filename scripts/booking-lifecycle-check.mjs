import assert from 'node:assert/strict';
import {
  createBookingRecord,
  transitionBooking,
  validateBookingForCheckout,
} from '../src/lib/bookingLifecycle.js';

const coveredZips = new Set(['94107']);

const baseBooking = {
  service: 'Myers Cocktail',
  protocolKey: 'myers',
  address: '188 King St',
  zip: '94107',
  date: '2026-05-23',
  acuitySlot: { datetime: '2026-05-23T21:00:00.000Z' },
  contact: {
    firstName: 'Sarah',
    lastName: 'Avalon',
    email: 'sarah@avalonvitality.co',
    phone: '(415) 980-7708',
  },
  guests: 1,
};

assert.equal(validateBookingForCheckout(baseBooking, { coveredZips }).ok, true);
assert.equal(validateBookingForCheckout({ ...baseBooking, contact: { ...baseBooking.contact, phone: '12' } }, { coveredZips }).ok, false);
assert.equal(validateBookingForCheckout({ ...baseBooking, zip: '99999' }, { coveredZips }).manualReview, true);
assert.equal(validateBookingForCheckout({ ...baseBooking, guests: 5 }, { coveredZips }).ok, false);
assert.equal(validateBookingForCheckout({ ...baseBooking, acuitySlot: { datetime: '2020-01-01T00:00:00.000Z' } }, { coveredZips }).ok, false);

const record = createBookingRecord({ ...baseBooking, addOns: ['NAD+'] });
assert.equal(record.status, 'Clearance Pending');
assert.equal(record.audit.length, 1);

const blockedAssign = transitionBooking(record, 'Nurse Assigned', { patch: { nurse: 'Stephanie R.' } });
assert.equal(blockedAssign.ok, false);

const cleared = transitionBooking(record, 'Cleared', { patch: { gfe: 'Cleared' } });
assert.equal(cleared.ok, true);
const assigned = transitionBooking(cleared.booking, 'Nurse Assigned', { patch: { nurse: 'Stephanie R.' } });
assert.equal(assigned.ok, true);
const enRoute = transitionBooking(assigned.booking, 'En Route');
assert.equal(enRoute.ok, true);
const completedTooEarly = transitionBooking(assigned.booking, 'Completed');
assert.equal(completedTooEarly.ok, false);

console.log('Booking lifecycle checks passed.');
