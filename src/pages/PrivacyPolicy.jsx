import React from 'react';
import LegalPageShell from '../components/landing/LegalPageShell';

const SECTIONS = [
  {
    h: 'Who we are',
    p: [
      'Avalon Vitality, Inc. ("Avalon," "we," "us," "our") is a California-licensed mobile health and longevity service operating exclusively in California. We provide in-home and concierge IV therapy, intramuscular and subcutaneous injections, NAD+, peptides (where available), supplements, and software-driven protocol design via the Avalon OS platform.',
      'This Privacy Policy explains how we collect, use, share, and protect your personal information when you visit avalonvitality.co, use the Avalon OS application, or engage our clinical services.',
    ],
  },
  {
    h: 'Scope and California focus',
    p: [
      'Avalon currently serves California residents only. This Privacy Policy is written to comply with California law, including the California Consumer Privacy Act of 2018 ("CCPA") as amended by the California Privacy Rights Act ("CPRA"), the California Confidentiality of Medical Information Act ("CMIA"), and the federal Health Insurance Portability and Accountability Act ("HIPAA") where applicable.',
      'If you are not a California resident, please do not provide information through our Services.',
    ],
  },
  {
    h: 'Information we collect',
    p: [
      'We collect three categories of information.',
    ],
    list: [
      'Identifiers: full legal name, postal address, email, phone number, IP address, device identifiers, and government-issued ID where required for clinical onboarding.',
      'Medical and health information: medical history, current medications, allergies, lab results, vital signs, biomarker data, biosensor and wearable data you authorize us to import, signed clinical consent forms, intake questionnaires, and any communications with our clinical staff.',
      'Commercial information: membership tier, services purchased, payment method tokens (we never store full card numbers — those are held by our PCI-DSS-compliant payment processor), and transaction history.',
      'Internet and device activity: browser type, pages visited, referring URL, session duration, cookies, and similar technologies on avalonvitality.co and within Avalon OS.',
      'Geolocation: city or neighborhood (precise location only if you authorize concierge in-home delivery).',
      'Inferences drawn from the above to design protocols and recommend services.',
    ],
  },
  {
    h: 'How we collect information',
    p: [
      'Directly from you when you submit forms, schedule services, communicate with our team, or upload documents.',
      'Automatically through cookies and similar technologies on our website.',
      'From third parties — our payment processor, our laboratory and pharmacy partners, identity-verification services, and (with your authorization) integrated wearables and biosensor providers.',
    ],
  },
  {
    h: 'How we use your information',
    p: [
      'To provide the Services you request, including scheduling, in-home or remote consultations, prescribing where authorized by a California-licensed physician, and protocol design.',
      'To process payments, manage memberships including the Founding 100 cohort, and send transactional and account communications.',
      'To improve clinical outcomes through Avalon OS, by combining outcome and biomarker data (de-identified where possible) to refine future protocols.',
      'To comply with California medical record retention requirements, federal HIPAA obligations, audits, and other legal duties.',
      'To prevent fraud, enforce our Terms of Service, and protect the rights, property, and safety of Avalon, our members, and our staff.',
      'For internal research and product improvement using aggregated and de-identified data.',
    ],
  },
  {
    h: 'Health information and HIPAA',
    p: [
      'Some of the information you share with us is "Protected Health Information" (PHI) under HIPAA. PHI is treated under our separate Notice of Privacy Practices, which is incorporated into this policy by reference.',
      'We disclose PHI only for treatment, payment, healthcare operations, or as authorized by you or required by law. We never sell PHI.',
    ],
  },
  {
    h: 'How we share your information',
    p: [
      'We do not sell personal information for money. We may share your information in the following limited circumstances.',
    ],
    list: [
      'Service providers acting on our behalf under written confidentiality and HIPAA business-associate agreements (cloud hosting, payment processing, communications, analytics, lab work, pharmacy fulfillment, courier delivery).',
      'Healthcare partners directly involved in your care, with your authorization.',
      'Legal authorities when compelled by lawful process, in response to a subpoena, or when necessary to investigate fraud or imminent harm.',
      'Successors in the event of a merger, acquisition, financing, or sale of all or substantially all of our assets, with prior notice to you.',
    ],
  },
  {
    h: 'Cookies and similar technologies',
    p: [
      'We use cookies and similar technologies for authentication, security, analytics, and personalization. Our Cookie Policy describes the categories, purposes, and your choices in detail.',
      'You can control cookies through your browser settings or our cookie banner. Declining non-essential cookies will not break the Services.',
      'We honor "Do Not Track" and Global Privacy Control signals where reasonably feasible. We do not use cross-context behavioral advertising and we do not "share" personal information for cross-context behavioral advertising as defined by the CPRA.',
    ],
  },
  {
    h: 'Your California privacy rights',
    p: [
      'As a California resident, you have the following rights under the CCPA/CPRA.',
    ],
    list: [
      'Right to know what personal information we have collected about you, including categories, sources, purposes, and the categories of third parties with whom we share it.',
      'Right to delete personal information, subject to legal exceptions (such as medical record retention requirements).',
      'Right to correct inaccurate personal information.',
      'Right to opt out of the sale or sharing of personal information — Avalon does not sell or share for cross-context behavioral advertising, so this is informational.',
      'Right to limit use of sensitive personal information to what is necessary to provide the Services.',
      'Right to non-discrimination for exercising any of these rights.',
    ],
  },
  {
    h: 'How to exercise your rights',
    p: [
      'To exercise any privacy right, email privacy@avalonvitality.co or call (415) 980-7708. You may also designate an authorized agent to act on your behalf.',
      'For your protection, we will verify your identity before fulfilling a request. We will respond within the timeframes required by California law (generally 45 days, with one possible 45-day extension).',
    ],
  },
  {
    h: 'Data retention',
    p: [
      'We retain personal information as long as needed to provide the Services and to meet legal, accounting, audit, or regulatory requirements. Medical records are retained for the period required by California law (typically 7 years from the last visit, or 1 year past age of majority for minors).',
      'When retention is no longer required, we delete or de-identify the information.',
    ],
  },
  {
    h: 'Security',
    p: [
      'We use administrative, physical, and technical safeguards designed to protect your information, including encryption in transit and at rest, role-based access controls, employee training, and HIPAA-required protections for PHI.',
      'No system is perfectly secure. If we discover a breach affecting your information, we will notify you as required by California Civil Code §1798.82 and HIPAA.',
    ],
  },
  {
    h: 'Children',
    p: [
      'Our Services are not directed to children under 18. We do not knowingly collect personal information from children under 18. If you believe we have, contact us at privacy@avalonvitality.co and we will delete it.',
    ],
  },
  {
    h: 'Updates to this policy',
    p: [
      'We may update this Privacy Policy from time to time. The "Last updated" date at the top of this page reflects the most recent version. Material changes will be communicated via the Services or by email.',
    ],
  },
  {
    h: 'Contact us',
    p: [
      'Privacy questions or rights requests: privacy@avalonvitality.co',
      'General inquiries: support@avalonvitality.co · (415) 980-7708',
      'Avalon Vitality, Inc. · San Francisco, California · United States',
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      lastUpdated="April 26, 2026"
      sections={SECTIONS}
      related={[
        { to: '/terms-and-conditions', label: 'Terms of Service' },
        { to: '/notice-of-privacy-practices', label: 'Notice of Privacy Practices' },
        { to: '/cookie-policy', label: 'Cookie Policy' },
      ]}
    />
  );
}
