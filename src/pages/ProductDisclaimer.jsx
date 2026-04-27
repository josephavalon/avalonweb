import React from 'react';
import LegalPageShell from '../components/landing/LegalPageShell';

const SECTIONS = [
  {
    h: 'FDA disclaimer',
    p: [
      'Statements made by Avalon Vitality about its services, products, IV therapies, intramuscular injections, subcutaneous injections, NAD+, peptides, supplements, and any related items have not been evaluated by the U.S. Food and Drug Administration. Avalon\'s services and products are not intended to diagnose, treat, cure, or prevent any disease.',
    ],
  },
  {
    h: 'Educational purpose',
    p: [
      'Information provided through avalonvitality.co, the Avalon OS application, and our marketing materials is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment from your physician or other qualified healthcare provider.',
      'Always seek the advice of your physician or other qualified healthcare provider with any questions you may have regarding a medical condition or treatment.',
    ],
  },
  {
    h: 'Individual results vary',
    p: [
      'Individual experience and outcomes vary. Testimonials, reviews, and case studies presented on the Services reflect the personal experience of specific individuals and are not a guarantee of results for any other person.',
      'No clinical service or wellness protocol can guarantee a specific outcome. Your results will depend on many factors, including baseline health, adherence to recommendations, lifestyle, and biology.',
    ],
  },
  {
    h: 'Compounded medications and peptides',
    p: [
      'Where Avalon offers compounded medications or peptides, those preparations are dispensed only after evaluation by a California-licensed clinician and are compounded by licensed compounding pharmacies. Compounded products are not FDA-approved.',
      'Discuss any clinical concerns, allergies, drug interactions, and medical history thoroughly with your clinician before beginning any therapy.',
    ],
  },
  {
    h: 'Supplements and nutrition',
    p: [
      'Dietary supplements and nutritional products offered through Avalon are subject to the Dietary Supplement Health and Education Act and the FDA disclaimer above. They are not drugs and are not intended to diagnose, treat, cure, or prevent any disease.',
    ],
  },
  {
    h: 'Risks and contraindications',
    p: [
      'Every clinical service carries risk. Your Avalon clinician will discuss material risks specific to your situation, including but not limited to bruising, infection, allergic reaction, and rare adverse events. Inform your clinician of all medications, supplements, allergies, and pre-existing conditions before any service.',
    ],
  },
  {
    h: 'No guarantee',
    p: [
      'Nothing on the Services constitutes a warranty or guarantee of any specific medical, aesthetic, or wellness outcome.',
    ],
  },
  {
    h: 'Contact',
    p: [
      'Clinical questions: support@avalonvitality.co · (415) 980-7708',
    ],
  },
];

export default function ProductDisclaimer() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Product Disclaimer"
      lastUpdated="April 26, 2026"
      sections={SECTIONS}
      related={[
        { to: '/terms-and-conditions', label: 'Terms of Service' },
        { to: '/telehealth-disclaimer', label: 'Telehealth Consent' },
        { to: '/notice-of-privacy-practices', label: 'Notice of Privacy Practices' },
      ]}
    />
  );
}
