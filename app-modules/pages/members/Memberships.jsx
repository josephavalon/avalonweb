import React from 'react';
import MemberSubPage from './MemberSubPage.jsx';

export default function Memberships() {
  return (
    <MemberSubPage
      eyebrow="Member"
      title="Memberships"
      description="Active plan, renewal date, and benefits will appear here."
      ctaLabel="Browse plans"
      ctaTo="/plan"
      seoPath="/members/memberships"
    />
  );
}
