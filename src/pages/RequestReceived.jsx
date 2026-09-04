import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import { useSeo } from '@/lib/seo';

// A visit to this public URL is not evidence that a form was submitted.
// Actual Cognito success remains responsible for submission notifications.
export default function RequestReceived() {
  useSeo({
    title: 'Request follow-up — Avalon Vitality',
    description: 'Next steps for your Avalon Vitality visit request. Our team confirms availability and clinical eligibility.',
    path: '/start/received',
    robots: 'noindex, nofollow',
  });

  return (
    <div className="nd-flow nd-request-received app-shell min-h-[100svh] bg-background text-foreground">
      <main>
        <div className="nd-request-received__mark" aria-hidden="true"><FileText /></div>
        <p>Request follow-up</p>
        <h1>YOUR NEXT STEPS.</h1>
        <span>
          If you submitted the visit request form, our team will contact you to confirm
          availability, clinical eligibility and next steps. If you have not submitted
          a form yet, continue to the visit request below.
        </span>
        <div>
          <Link to="/start">
            Request a visit <ArrowRight aria-hidden="true" />
          </Link>
          <a href="tel:+14159807708">Call (415) 980-7708</a>
        </div>
      </main>
    </div>
  );
}
