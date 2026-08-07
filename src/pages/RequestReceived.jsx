import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { ANALYTICS_EVENTS, trackConsented } from '@/lib/analytics';
import { useSeo } from '@/lib/seo';

const FLOW_STORAGE_KEY = 'av.guided.flow.v1';
const DIRECT_RECEIPT_KEY = 'av.request.receipt.v1';

function readGuidedFlow() {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(FLOW_STORAGE_KEY) || 'null');
    return value?.id && Number.isFinite(value?.selectedAt) ? value : null;
  } catch { return null; }
}

export default function RequestReceived() {
  useSeo({
    title: 'Request Received — Avalon Vitality',
    description: 'Your Avalon Vitality request has been received.',
    path: '/start/received',
    robots: 'noindex, nofollow',
  });

  useEffect(() => {
    const flow = readGuidedFlow();
    const dedupeKey = flow ? `av.guided.receipt.${flow.id}` : DIRECT_RECEIPT_KEY;
    try {
      if (window.sessionStorage.getItem(dedupeKey)) return;
    } catch { /* continue with a best-effort event */ }

    const tracked = flow
      ? trackConsented(ANALYTICS_EVENTS.REQUEST_SUBMITTED, {
          flow_id: flow.id,
          elapsed_ms: Math.max(0, Date.now() - Number(flow.recommendedAt || flow.selectedAt)),
        })
      : trackConsented(ANALYTICS_EVENTS.REQUEST_SUBMITTED);

    if (tracked) {
      try { window.sessionStorage.setItem(dedupeKey, '1'); } catch { /* best-effort dedupe */ }
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
