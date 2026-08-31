import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { ANALYTICS_EVENTS, trackConsented } from '@/lib/analytics';
import { pingIntakeAlert } from '@/lib/intakeAlert';
import { readGuidedFlow, timestampGuidedFlow } from '@/lib/guidedSession';
import { useSeo } from '@/lib/seo';

const DIRECT_RECEIPT_KEY = 'av.request.receipt.v1';

export default function RequestReceived() {
  useSeo({
    title: 'Request Received — Avalon Vitality',
    description: 'Your Avalon Vitality request has been received.',
    path: '/start/received',
    robots: 'noindex, nofollow',
  });

  useEffect(() => {
    // Belt to CognitoSubmitPing's braces: if Cognito redirects here instead of
    // swapping in place, this is the only signal that a request landed. Both
    // share one sessionStorage key, so the admins still get exactly one text.
    pingIntakeAlert('start');

    const storedFlow = readGuidedFlow();
    const flow = Number.isFinite(storedFlow?.selectedAt) ? storedFlow : null;
    if (flow?.submittedAt) return;
    if (!flow) {
      try {
        const submittedAt = window.sessionStorage.getItem(DIRECT_RECEIPT_KEY);
        if (submittedAt && Number.isFinite(Number(submittedAt))) return;
      } catch { /* continue */ }
    }

    const tracked = flow
      ? trackConsented(ANALYTICS_EVENTS.REQUEST_SUBMITTED, {
          flow_id: flow.id,
          elapsed_ms: Math.max(0, Date.now() - Number(flow.recommendedAt || flow.selectedAt)),
        })
      : trackConsented(ANALYTICS_EVENTS.REQUEST_SUBMITTED);

    if (!tracked) return;
    if (flow) timestampGuidedFlow(flow.id, 'submittedAt');
    else {
      try { window.sessionStorage.setItem(DIRECT_RECEIPT_KEY, String(Date.now())); } catch { /* best-effort dedupe */ }
    }
  }, []);

  return (
    <div className="nd-flow nd-request-received app-shell min-h-[100svh] bg-background text-foreground">
      <main>
        <div className="nd-request-received__mark" aria-hidden="true"><Check /></div>
        <p>Request received</p>
        <h1>WE'LL TAKE IT FROM HERE.</h1>
        <span>
          Your care team will review your request and contact you to confirm eligibility and next steps.
        </span>
        <div>
          <Link to="/">
            Return home <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/protocols">View therapies</Link>
        </div>
      </main>
    </div>
  );
}
