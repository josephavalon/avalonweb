import { useState } from 'react';
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
  const [submitted, setSubmitted] = useState(false);

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

        <section className="nd-plan__form" aria-labelledby="plan-form-title">
          {submitted ? (
            <div className="nd-plan__thanks" role="status">
              <span><Check aria-hidden="true" /></span>
              <p className="nd-plan__eyebrow">Request received</p>
              <h2 id="plan-form-title">We&apos;ll text you.</h2>
              <p>A real person will explain the plan options and next steps.</p>
            </div>
          ) : (
            <>
              <p className="nd-plan__eyebrow">Start here</p>
              <h2 id="plan-form-title">Name + mobile</h2>
              <p className="nd-plan__form-copy">That&apos;s all we need for now.</p>
              <CognitoFormEmbed
                formId=""
                accountKey=""
                compact
                buttonLabel="Request plan details"
                onSubmit={() => setSubmitted(true)}
                submitTestId="plan-request-submit"
              />
              <p className="nd-plan__privacy">
                <ShieldCheck aria-hidden="true" />
                Do not include medical information. This request is for plan information only.
              </p>
              <p className="nd-plan__consent">
                By submitting, you consent to service-related SMS from Avalon Vitality.
                Reply STOP to opt out. Message and data rates may apply. This request
                does not confirm an appointment or guarantee treatment.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
