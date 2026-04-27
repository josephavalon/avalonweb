import React from 'react';
import LegalPageShell from '../components/landing/LegalPageShell';

const SECTIONS = [
  {
    h: '1. Introduction',
    p: [
      'Welcome to Avalon Vitality. These Terms of Service ("Terms") govern your access to and use of avalonvitality.co, the Avalon OS application, and any concierge clinical services Avalon provides (collectively, the "Services").',
      'By accessing or using any of the Services, you agree to be bound by these Terms and by our Privacy Policy. If you do not agree, do not use the Services.',
    ],
  },
  {
    h: '2. Who we are and where we operate',
    p: [
      'Avalon Vitality, Inc. is a California corporation. The Services are offered exclusively to California residents physically located in California at the time of service. We do not currently provide services outside California.',
      'All clinical services are provided by California-licensed physicians, nurse practitioners, registered nurses, and other healthcare professionals operating within their California scope of practice.',
    ],
  },
  {
    h: '3. Eligibility',
    p: [
      'You must be at least 18 years old, a California resident, and physically located in California at the time of service to use Avalon. By using the Services, you represent and warrant that you meet these criteria and that the information you provide is accurate and complete.',
    ],
  },
  {
    h: '4. The relationship between us',
    p: [
      'Avalon is a healthcare and longevity service. The Services may include — but are not a substitute for — a relationship with a primary care physician. Avalon clinicians do not replace your primary care provider, urgent care, or emergency services.',
      'If you are experiencing a medical emergency, call 911 or go to the nearest emergency department. Do not use Avalon for emergencies.',
    ],
  },
  {
    h: '5. No insurance accepted',
    p: [
      'Avalon is a private-pay, cash-based service. We do not accept insurance and do not bill any insurance plan, including Medicare, Medi-Cal, or any private insurer. You are responsible for all charges incurred. We do not provide superbills or insurance reimbursement codes.',
    ],
  },
  {
    h: '6. Memberships and credits',
    p: [
      'Avalon offers tiered memberships, including the Founding 100 cohort, with monthly or annual billing. Membership credits accrue per the terms of your selected tier and apply toward eligible services.',
      'Unused credits may roll over for a limited period as defined in your member agreement. Memberships auto-renew unless cancelled in accordance with the cancellation policy below.',
    ],
  },
  {
    h: '7. Cancellation, refunds, and rescheduling',
    p: [
      'Single-visit appointments may be rescheduled or cancelled at no charge up to 24 hours before the scheduled time. Cancellations within 24 hours forfeit any prepaid service fee or one membership credit.',
      'Memberships may be cancelled at any time effective at the end of the current billing period. Avalon does not provide refunds for the current billing period after the period has begun.',
      'In the event a clinician cannot complete a scheduled service due to a clinical safety concern (for example, vital signs outside safe parameters), the visit will be rescheduled or refunded at our discretion.',
    ],
  },
  {
    h: '8. Prescription products and laboratory services',
    p: [
      'Where Avalon offers prescription products, peptides, or laboratory testing, those products and services are dispensed only after evaluation by a California-licensed clinician. Prescription medications are dispensed by licensed pharmacies.',
      'Avalon does not guarantee that any particular medication, peptide, or therapy will be prescribed. Clinical decisions remain the sole judgment of the treating clinician.',
    ],
  },
  {
    h: '9. Telehealth consent',
    p: [
      'Some Services may be delivered via telehealth (audio or video consultation) in accordance with California Business and Professions Code §2290.5. By using telehealth Services, you consent to the use of telehealth and acknowledge the risks and benefits, including the possibility of technical failure and the limitations of remote evaluation.',
      'You may withdraw telehealth consent at any time without affecting your right to in-person care.',
    ],
  },
  {
    h: '10. Payment',
    p: [
      'You authorize Avalon to charge the payment method on file for the Services and memberships you purchase. All fees are in U.S. dollars and exclude applicable taxes.',
      'If a charge is declined, Avalon may suspend Services until payment is made.',
    ],
  },
  {
    h: '11. User accounts and security',
    p: [
      'You are responsible for keeping your account credentials confidential and for all activity under your account. Notify us immediately at support@avalonvitality.co if you suspect unauthorized use.',
    ],
  },
  {
    h: '12. Acceptable use',
    p: [
      'You agree not to misuse the Services. Specifically, you may not (a) impersonate another person; (b) submit false medical history; (c) attempt to circumvent technical limits of the Services; (d) reverse-engineer the Avalon OS application; (e) use the Services for any unlawful purpose; or (f) interfere with or disrupt the Services.',
    ],
  },
  {
    h: '13. Intellectual property',
    p: [
      'Avalon, Avalon Vitality, Avalon OS, the Avalon logo and word marks, and all content of the Services are owned by Avalon Vitality, Inc. or its licensors. Nothing in these Terms grants you any right in or to our intellectual property except a limited, revocable, non-exclusive license to use the Services as intended.',
    ],
  },
  {
    h: '14. Submissions',
    p: [
      'If you submit feedback or suggestions, you grant Avalon a perpetual, royalty-free, worldwide license to use them to improve the Services.',
    ],
  },
  {
    h: '15. Third-party services',
    p: [
      'The Services may integrate with third-party services (e.g., wearables, payment processors, scheduling tools). Your use of those services is governed by their terms. Avalon is not responsible for third-party services.',
    ],
  },
  {
    h: '16. Termination',
    p: [
      'We may suspend or terminate your access to the Services at any time for breach of these Terms, behavior that endangers our staff, or as required by law. You may terminate your account at any time by contacting support@avalonvitality.co.',
    ],
  },
  {
    h: '17. Disclaimers',
    p: [
      'Statements made by Avalon about its services and products have not been evaluated by the U.S. Food and Drug Administration. The Services are not intended to diagnose, treat, cure, or prevent any disease.',
      'Individual results vary. Information provided through the Services is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment from your physician.',
      'EXCEPT AS REQUIRED BY LAW, THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.',
    ],
  },
  {
    h: '18. Limitation of liability',
    p: [
      'TO THE MAXIMUM EXTENT PERMITTED BY CALIFORNIA LAW, AVALON, ITS OFFICERS, EMPLOYEES, CLINICIANS, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICES.',
      'Avalon\'s aggregate liability for any claim arising out of these Terms or the Services is limited to the amounts you paid Avalon in the 12 months preceding the event giving rise to the claim. Nothing in these Terms limits liability that cannot be limited under California law.',
    ],
  },
  {
    h: '19. Indemnification',
    p: [
      'You agree to indemnify and hold harmless Avalon and its affiliates from claims, damages, and expenses (including reasonable attorneys\' fees) arising out of (a) your breach of these Terms, (b) your misuse of the Services, or (c) your violation of any third-party right or applicable law.',
    ],
  },
  {
    h: '20. Governing law and venue',
    p: [
      'These Terms are governed by the laws of the State of California, without regard to conflict-of-law principles. Any dispute will be resolved exclusively in the state or federal courts located in San Francisco County, California, except for disputes subject to arbitration as provided below.',
    ],
  },
  {
    h: '21. Arbitration and class waiver',
    p: [
      'Any dispute, claim, or controversy arising out of or relating to these Terms or the Services that cannot be resolved informally will be resolved by binding individual arbitration administered by JAMS in San Francisco, California, under its Streamlined Arbitration Rules.',
      'YOU AND AVALON EACH WAIVE THE RIGHT TO TRIAL BY JURY OR TO PARTICIPATE IN A CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION. This arbitration clause does not apply to claims that cannot be arbitrated under California law, including certain claims under the California Private Attorneys General Act.',
      'You may opt out of arbitration within 30 days of first accepting these Terms by emailing legal@avalonvitality.co with the subject line "Arbitration Opt-Out."',
    ],
  },
  {
    h: '22. Changes to these Terms',
    p: [
      'We may update these Terms from time to time. The "Last updated" date at the top of this page reflects the most recent version. We will notify you of material changes by email or through the Services. Your continued use of the Services after the effective date of any change constitutes acceptance of the change.',
    ],
  },
  {
    h: '23. Miscellaneous',
    p: [
      'These Terms, together with the Privacy Policy and any additional terms you agree to, are the entire agreement between you and Avalon and supersede prior agreements on the same subject.',
      'If any provision is held unenforceable, the remaining provisions remain in full effect. Avalon\'s failure to enforce any provision is not a waiver of its right to do so later. You may not assign these Terms; we may assign them in connection with a merger, acquisition, or sale of assets.',
    ],
  },
  {
    h: '24. Contact',
    p: [
      'Avalon Vitality, Inc. · San Francisco, California',
      'support@avalonvitality.co · (415) 980-7708',
    ],
  },
];

export default function TermsAndConditions() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Terms of Service"
      lastUpdated="April 26, 2026"
      sections={SECTIONS}
      related={[
        { to: '/privacy-policy', label: 'Privacy Policy' },
        { to: '/notice-of-privacy-practices', label: 'Notice of Privacy Practices' },
        { to: '/cookie-policy', label: 'Cookie Policy' },
      ]}
    />
  );
}
