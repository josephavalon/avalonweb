import React from 'react';
import MemberSubPage from './MemberSubPage.jsx';

export default function Bookings() {
  return (
    <MemberSubPage
      eyebrow="Member"
      title="My Bookings"
      description="Your upcoming visits, drip plans, and visit history land here."
      ctaLabel="Book a visit"
      ctaTo="/book"
      seoPath="/members/bookings"
    />
  );
}
