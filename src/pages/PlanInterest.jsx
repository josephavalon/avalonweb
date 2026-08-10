import { Link } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import CognitoFormEmbed from '@/components/forms/CognitoFormEmbed';
import { useSeo } from '@/lib/seo';

const TRUST_POINTS = [
  'No medical history here',
  'No commitment',
  'Clinical review before care',
];

export default function PlanInterest() {
  useSeo({
    title: 'Plans — Avalon Vitality',
    description: 'Request simple, clinician-supported wellness plan information from Avalon Vitality.',
    path: '/subscription',
  });

  return (
    <div className="nd-plan">
      <header className="nd-plan__header">
        <Link to="/" className="nd-plan__brand" aria-label="Avalon Vitality home">
          <AvalonMark className="nd-plan__brand-mark" />
          <span>Avalon Vitality</span>
        </Link>
      </header>

      <main className="nd-plan__main">
        <section className="nd-plan__copy">
          <p className="nd-plan__eyebrow">Avalon Plans</p>
          <h1>A simpler way<br />to stay consistent.</h1>
          <p className="nd-plan__lede">
            Share your name and mobile. A plan coordinator will explain the options.
          </p>

          <ul className="nd-plan__trust">
            {TRUST_POINTS.map((point) => (
              <li key={point}>
                <Check aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </section>

        {/* The Cognito iframe confirms on its own origin, so there is no local
            "submitted" state here — this page never learns that a request was
            sent, by design. */}
        <section className="nd-plan__form" aria-labelledby="plan-form-title">
          <p className="nd-plan__eyebrow">Start here</p>
          <h2 id="plan-form-title">Name + mobile</h2>
          <p className="nd-plan__form-copy">That&apos;s all we need for now.</p>
          <CognitoFormEmbed compact />
          <p className="nd-plan__privacy">
            <ShieldCheck aria-hidden="true" />
            Do not include medical information. This request is for plan information only.
          </p>
          <p className="nd-plan__consent">
            By submitting, you consent to service-related SMS from Avalon Vitality.
            Reply STOP to opt out. Message and data rates may apply. This request
            does not confirm an appointment or guarantee treatment.
          </p>
        </section>
      </main>
    </div>
  );
}
