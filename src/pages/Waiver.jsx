import React from 'react';
import LegalPageShell from '../components/landing/LegalPageShell';

const SECTIONS = [
  {
    h: 'Voluntary consent',
    p: [
      'In consideration for being permitted to voluntarily use the services, equipment, facilities, or interventional therapies provided by Avalon Vitality ("Company"), its staff, contractors, and licensed affiliates — whether at the Company office at 275 8th Street, Third Floor, San Francisco, California 94103, or at any other location arranged by Company — I voluntarily consent to receive care and to the terms of this waiver.',
    ],
  },
  {
    h: 'Services',
    p: [
      'Avalon Vitality provides wellness services that may include intravenous (IV) hydration, vitamin and nutrient infusions, intramuscular (IM) injections, and related interventional therapies, delivered by California-licensed registered nurses and nurse practitioners under the supervision of a California-licensed physician. Services are offered at the Company office and at mobile locations selected by the client.',
    ],
  },
  {
    h: 'Assumption of risk',
    p: [
      'I understand that IV, IM, and injection therapies carry inherent risks, and that despite the reasonable care exercised by Avalon\'s clinicians, adverse reactions can occur. I have had the opportunity to ask questions and to discuss risks with my clinician. Knowing these risks, I voluntarily assume them and consent to treatment.',
    ],
    list: [
      'Nausea, flushing, or a warm sensation during infusion.',
      'Bruising, tenderness, redness, or swelling at the injection or IV site.',
      'Rare injection-site reactions including hives or transient irritation.',
      'Vasovagal response (lightheadedness or fainting) during or after treatment.',
      'Infiltration or extravasation (fluid leaking outside the vein), which may cause localized discomfort or swelling.',
      'Vein irritation or, rarely, phlebitis (vein inflammation).',
      'Rare allergic reactions to constituents of the infusion or injection.',
      'Rare risk of infection at the puncture site.',
      'Interactions with medications, supplements, or underlying conditions that were not disclosed to the clinician.',
    ],
  },
  {
    h: 'Not FDA-approved for treating disease',
    p: [
      'Avalon Vitality\'s IV, IM, and injection services are intended to support general wellness, hydration, and recovery. They are not FDA-approved for the diagnosis, cure, mitigation, treatment, or prevention of any disease or medical condition. Individual results vary. Nothing about these services should be understood as a substitute for evaluation and treatment by your primary care physician or other treating clinician.',
    ],
  },
  {
    h: 'Your health disclosures',
    p: [
      'I agree to disclose truthfully and completely, at each visit, my current medical conditions, medications, supplements, allergies, pregnancy status (if applicable), recent illnesses, and any other information that a reasonable clinician would want to know before administering treatment. I understand that Avalon\'s clinicians rely on my disclosures to make treatment decisions, and that failure to disclose material information may increase the risk of harm.',
    ],
  },
  {
    h: 'Release and indemnification',
    p: [
      'To the fullest extent permitted by California law, I release, waive, discharge, and covenant not to sue Avalon Vitality, its owners, officers, employees, contractors, licensed affiliates, and agents (collectively, the "Released Parties") from any and all claims, demands, causes of action, and liabilities arising out of or related to services rendered, EXCEPT to the extent caused by the gross negligence or willful misconduct of a Released Party.',
      'I agree to indemnify and hold the Released Parties harmless from any third-party claim brought against them arising out of my failure to disclose material health information, my violation of the terms of this waiver, or my violation of applicable law.',
    ],
  },
  {
    h: 'Privacy',
    p: [
      'My protected health information is handled in accordance with HIPAA, the California Confidentiality of Medical Information Act (CMIA), and Avalon\'s Notice of Privacy Practices. Information collected in the course of treatment is used only for treatment, payment, and operations, and is not sold. See our Notice of Privacy Practices for detail on how information is used and disclosed and how to exercise your rights.',
    ],
  },
  {
    h: 'Right to withdraw',
    p: [
      'I understand that I may refuse any part of treatment at any time, and that I may withdraw this consent as to future services at any time by written notice to Avalon Vitality. Withdrawal of consent is prospective and does not affect care already provided or obligations already incurred.',
    ],
  },
  {
    h: 'Governing law',
    p: [
      'This waiver is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or related to this waiver or the services provided will be resolved exclusively in the state or federal courts located in San Francisco County, California.',
    ],
  },
  {
    h: 'Contact',
    p: [
      'support@avalonvitality.co · (415) 980-7708 · 275 8th Street, Third Floor, San Francisco, California 94103',
    ],
  },
];

export default function Waiver() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Liability Waiver"
      lastUpdated="July 20, 2026"
      sections={SECTIONS}
      related={[
        { to: '/terms-of-service', label: 'Terms of Service' },
        { to: '/privacy-policy', label: 'Privacy Policy' },
        { to: '/telehealth-disclaimer', label: 'Telehealth Consent' },
        { to: '/notice-of-privacy-practices', label: 'Notice of Privacy Practices' },
      ]}
    />
  );
}
