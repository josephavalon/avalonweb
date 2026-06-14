import React from 'react';
import MemberSubPage from './MemberSubPage.jsx';

export default function Billing() {
  return (
    <MemberSubPage
      eyebrow="Member"
      title="Billing"
      description="Receipts, payment methods, and invoices live here."
      ctaLabel="Email support"
      ctaTo="mailto:support@avalonvitality.co"
      seoPath="/members/billing"
    />
  );
}
