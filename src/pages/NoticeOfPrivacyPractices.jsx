import React from 'react';
import LegalPageShell from '../components/landing/LegalPageShell';

const SECTIONS = [
  {
    h: 'Your rights',
    p: [
      'This Notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review it carefully.',
      'Avalon Vitality is required by law to protect the privacy of your protected health information ("PHI"), provide you with this Notice of our legal duties and privacy practices, and follow the terms of the Notice currently in effect.',
    ],
  },
  {
    h: 'Who follows this notice',
    p: [
      'This Notice applies to Avalon Vitality and all employees, clinicians, contractors, and business associates who provide healthcare services on Avalon\'s behalf in California.',
    ],
  },
  {
    h: 'How we may use and disclose your PHI',
    p: [
      'For treatment. We use and disclose PHI to provide healthcare services to you, including consultations with our clinicians, coordination of laboratory work, pharmacy fulfillment, and follow-up care.',
      'For payment. We use and disclose PHI to bill and collect payment for the services we provide. We do not bill insurance.',
      'For healthcare operations. We use and disclose PHI to operate our practice, including quality assessment, training, accreditation, and business management.',
      'As authorized by you. We will not use or disclose your PHI for any other purpose without your written authorization. You may revoke an authorization in writing at any time, except to the extent we have already relied on it.',
    ],
  },
  {
    h: 'Special situations where we may use or disclose PHI without authorization',
    p: ['California and federal law permit limited disclosures without your authorization. Examples include:'],
    list: [
      'Public health activities (reporting communicable disease, FDA-required reporting on regulated products).',
      'Reporting suspected abuse, neglect, or domestic violence as required by California law.',
      'Health oversight activities such as audits, investigations, and licensure inspections.',
      'Judicial and administrative proceedings in response to a valid order, subpoena, or discovery request.',
      'Law enforcement when permitted by law (e.g., to identify a fugitive, victim, or to report crime on premises).',
      'To coroners, medical examiners, and funeral directors as permitted by law.',
      'For organ and tissue donation as permitted by law.',
      'For research with appropriate IRB or privacy-board waivers.',
      'To prevent a serious threat to health or safety.',
      'For specialized government functions (military, national security, protective services).',
      'Workers\' compensation as required by California law.',
    ],
  },
  {
    h: 'Your rights regarding your PHI',
    p: ['Under HIPAA and California law, you have the following rights.'],
    list: [
      'Right to inspect and copy. You have the right to inspect and obtain a copy of your medical records, in paper or electronic form. We may charge a reasonable, cost-based fee permitted by California law.',
      'Right to amend. If you believe your PHI is incorrect or incomplete, you may ask us to amend it. We may deny in limited circumstances.',
      'Right to an accounting of disclosures. You may request a list of certain disclosures of your PHI made in the past six years.',
      'Right to request restrictions. You may ask us to restrict how we use or disclose your PHI for treatment, payment, or healthcare operations. We are not required to agree, but if we do, we will honor the restriction except in emergencies.',
      'Right to confidential communications. You may ask us to communicate with you in a specific way (e.g., a particular phone number or address).',
      'Right to a paper copy of this Notice. You may request a paper copy at any time, even if you have agreed to receive it electronically.',
      'Right to be notified of a breach of unsecured PHI as required by law.',
    ],
  },
  {
    h: 'How to exercise your rights',
    p: [
      'To exercise any of the rights above, contact our Privacy Officer in writing at privacy@avalonvitality.co. We will respond within the timeframes required by HIPAA and California law.',
    ],
  },
  {
    h: 'Complaints',
    p: [
      'If you believe your privacy rights have been violated, you may file a complaint with us at privacy@avalonvitality.co or with the U.S. Department of Health and Human Services Office for Civil Rights at https://www.hhs.gov/ocr/. You may also file with the California Attorney General. We will not retaliate against you for filing a complaint.',
    ],
  },
  {
    h: 'California-specific rights',
    p: [
      'California Confidentiality of Medical Information Act (CMIA). California provides additional protections for medical information beyond HIPAA. We follow California law where it provides greater protection.',
      'CCPA/CPRA. PHI governed by HIPAA is generally exempt from the CCPA/CPRA, but other personal information about you (e.g., website usage data) is covered by our Privacy Policy.',
    ],
  },
  {
    h: 'Changes to this notice',
    p: [
      'We reserve the right to change this Notice and to make the new Notice effective for all PHI we maintain. The current version is always posted at avalonvitality.co/notice-of-privacy-practices and a paper copy is available on request.',
    ],
  },
  {
    h: 'Contact our Privacy Officer',
    p: [
      'Avalon Vitality · Attn: Privacy Officer',
      'San Francisco, California',
      'privacy@avalonvitality.co · (415) 980-7708',
    ],
  },
];

export default function NoticeOfPrivacyPractices() {
  return (
    <LegalPageShell
      eyebrow="HIPAA"
      title="Notice of Privacy Practices"
      lastUpdated="April 26, 2026"
      intro={[
        'This Notice is provided pursuant to the Health Insurance Portability and Accountability Act of 1996 ("HIPAA"), the California Confidentiality of Medical Information Act, and other applicable law.',
      ]}
      sections={SECTIONS}
      related={[
        { to: '/privacy-policy', label: 'Privacy Policy' },
        { to: '/terms-and-conditions', label: 'Terms of Service' },
        { to: '/cookie-policy', label: 'Cookie Policy' },
      ]}
    />
  );
}
