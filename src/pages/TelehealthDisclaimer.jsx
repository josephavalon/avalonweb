import React from 'react';
import LegalPageShell from '../components/landing/LegalPageShell';

const SECTIONS = [
  {
    h: 'Scope',
    p: [
      'Avalon Vitality, Inc. provides certain services via telehealth to California residents physically located in California at the time of service. Telehealth services are provided in accordance with California Business and Professions Code §2290.5 and other applicable California law.',
    ],
  },
  {
    h: 'What telehealth is',
    p: [
      'Telehealth is the delivery of healthcare services via interactive audio, video, or other electronic media. Avalon\'s telehealth visits are conducted by California-licensed clinicians.',
    ],
  },
  {
    h: 'Your consent',
    p: [
      'By engaging telehealth services with Avalon, you consent to the use of telehealth and acknowledge that you have been informed of the following:',
    ],
    list: [
      'You may discuss your care with your clinician via interactive audio or video.',
      'You have the right to withhold or withdraw consent to telehealth at any time, without affecting your right to in-person care.',
      'There are potential risks, including limitations of remote evaluation, possible technical failures, security risks, and the possibility that information transmitted may not be sufficient for a thorough evaluation.',
      'There are potential benefits, including increased access to care, time savings, and the ability to receive care from your home.',
      'Your information is protected under HIPAA and California privacy law.',
    ],
  },
  {
    h: 'Limitations',
    p: [
      'Telehealth is not appropriate for emergencies. If you are experiencing an emergency, call 911 or go to the nearest emergency department.',
      'Some clinical conditions and services cannot be safely or appropriately addressed via telehealth. Your Avalon clinician will tell you if your situation requires in-person evaluation.',
      'Telehealth services are limited to California-licensed clinicians treating patients physically located in California.',
    ],
  },
  {
    h: 'Prescriptions',
    p: [
      'When clinically appropriate and consistent with California law, your Avalon clinician may issue prescriptions during a telehealth visit. Prescriptions are dispensed by licensed pharmacies. Avalon does not guarantee that any particular medication will be prescribed; clinical judgment remains with the treating clinician.',
    ],
  },
  {
    h: 'Records and continuity of care',
    p: [
      'Telehealth visits are documented in your Avalon medical record. Records are maintained per California law and our Privacy Policy and Notice of Privacy Practices.',
    ],
  },
  {
    h: 'Complaints',
    p: [
      'If you have a concern about a telehealth service, contact us at support@avalonvitality.co. You may also file a complaint with the Medical Board of California (mbc.ca.gov) or the California Board of Registered Nursing (rn.ca.gov), as applicable.',
    ],
  },
  {
    h: 'Contact',
    p: [
      'support@avalonvitality.co · (415) 980-7708',
    ],
  },
];

export default function TelehealthDisclaimer() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Telehealth Consent"
      lastUpdated="April 26, 2026"
      sections={SECTIONS}
      related={[
        { to: '/terms-and-conditions', label: 'Terms of Service' },
        { to: '/notice-of-privacy-practices', label: 'Notice of Privacy Practices' },
        { to: '/product-disclaimer', label: 'Product Disclaimer' },
      ]}
    />
  );
}
