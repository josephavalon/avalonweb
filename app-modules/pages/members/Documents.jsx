import React from 'react';
import MemberSubPage from './MemberSubPage.jsx';

export default function Documents() {
  return (
    <MemberSubPage
      eyebrow="Member"
      title="Documents"
      description="Consent forms, lab results, and visit notes will appear here."
      ctaLabel="Contact your nurse"
      ctaTo="/members/messages"
      seoPath="/members/documents"
    />
  );
}
