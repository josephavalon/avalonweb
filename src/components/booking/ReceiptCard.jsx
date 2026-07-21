import React from 'react';
import { CalendarClock, Droplets, MapPin, CreditCard, Wallet, Stethoscope, Hash } from 'lucide-react';

// ReceiptCard — clean, screenshot-worthy summary used by both
// BookingConfirmation and CheckoutSuccess so the two thank-you screens look
// like one product. Renders only the rows it has data for; never fabricates.
//
// Props:
//   service       string  — e.g. "NAD+ IV — 60 min"
//   when          string  — e.g. "Sat Jun 29, 4:00 PM PT"
//   location      string  — e.g. "123 Main St, San Francisco"
//   depositPaid   number|string  — render formatted; null/undefined hides row
//   balanceDue    number|string  — same
//   nextStep      string  — e.g. "Stephanie Weeks, RN will text on the day…"
//   referenceNum  string
//
// Money: callers pre-format with their currency() helper to stay consistent
// with the rest of each page.

const ICONS = {
  service: Droplets,
  when: CalendarClock,
  location: MapPin,
  depositPaid: CreditCard,
  balanceDue: Wallet,
  nextStep: Stethoscope,
  referenceNum: Hash,
};

const LABELS = {
  service: 'Service',
  when: 'When',
  location: 'Where',
  depositPaid: 'Deposit paid today',
  balanceDue: 'Balance after visit',
  nextStep: 'Next step',
  referenceNum: 'Reference',
};

function Row({ field, value, emphasize }) {
  if (value === null || value === undefined || value === '') return null;
  const Icon = ICONS[field];
  const label = LABELS[field];
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[auto_8rem_1fr]">
      <span aria-hidden="true" className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.04] text-foreground/70">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <p className="col-start-2 sm:col-start-2 font-body text-[11px] font-black uppercase leading-tight tracking-[0.14em] text-foreground/52">
        {label}
      </p>
      <p className={`col-span-2 col-start-1 sm:col-span-1 sm:col-start-3 sm:row-start-1 font-body leading-snug text-foreground/88 ${emphasize ? 'text-[15px] font-black' : 'text-[14px] font-semibold'}`}>
        {value}
      </p>
    </div>
  );
}

export default function ReceiptCard({
  service,
  when,
  location,
  depositPaid,
  balanceDue,
  nextStep,
  referenceNum,
  className = '',
}) {
  return (
    <section
      aria-label="Booking receipt"
      className={`mx-auto w-full max-w-xl rounded-[1.5rem] border border-foreground/10 bg-foreground/[0.04] p-4 sm:p-5 ${className}`}
    >
      <div className="divide-y divide-foreground/8">
        <Row field="service" value={service} />
        <Row field="when" value={when} />
        <Row field="location" value={location} />
        <Row field="depositPaid" value={depositPaid} />
        <Row field="balanceDue" value={balanceDue} emphasize />
        <Row field="nextStep" value={nextStep} />
        <Row field="referenceNum" value={referenceNum} />
      </div>
    </section>
  );
}
