import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ANALYTICS_EVENTS, track } from '@/lib/analytics';
import { sanitizeCognitoPrefill } from '@/lib/cognitoPrefill';

// Cognito Forms embed — SEAMLESS. This is PHI-handling code.
//
// DECISION 2026-07-31 (user, explicit, after being shown the tradeoff twice):
// this component was a sealed cross-origin iframe. It is now Cognito's
// `seamless.js` embed. The iframe imposed Cognito's own chrome — white card,
// "Page 1 / Page 2" indicator, its own type — and Cognito's Theme editor has
// no custom-CSS escape hatch, so the front door could not be made to match the
// approved design. The user chose design fidelity over origin isolation.
//
// WHAT THAT COSTS — read before touching this file or the route that mounts it:
//   * seamless.js injects the form into AVALON'S document. The patient's name
//     and mobile number are real nodes in our DOM. `document.querySelector`
//     reaches them. So does every dependency in our bundle.
//   * therefore this component, and every page that mounts it, is PHI-handling
//     code. Do NOT add analytics with properties, error/exception reporting,
//     session replay, heatmaps, form-field instrumentation, or any DOM capture
//     to these routes. The only telemetry allowed here is the anonymous,
//     propertyless fire-once load ping below.
//   * a compromised dependency — ours or Cognito's — can read the fields. The
//     control is no longer the browser's origin boundary; it is our dependency
//     hygiene plus Cognito's CSP allowance.
//
// WHAT DID NOT CHANGE:
//   * Cognito is still the BAA-covered backend (HIPAA Enterprise plan, entry
//     encryption ON, every field Protected).
//   * form values still POST directly to cognitoforms.com. They never touch an
//     Avalon server, an Avalon API route, or Supabase.
//   * this component still renders NO fields of its own. Only Cognito's script
//     may create them — see the fail-closed fallback below.
//
// Ship requirement: set VITE_COGNITO_ACCOUNT_KEY (and optionally
// VITE_COGNITO_INTAKE_FORM_ID) at build time, and keep
// https://www.cognitoforms.com + https://static.cognitoforms.com in the
// front-door CSP's script-src / connect-src (see vercel.json).

const COGNITO_ORIGIN = 'https://www.cognitoforms.com';
const SEAMLESS_SRC = `${COGNITO_ORIGIN}/f/seamless.js`;

// The live intake ("Avalon Intake") is account form number 1 — confirmed from
// the Cognito Publish tab. `formId` is kept as the prop name for callsite
// compatibility, but it is a form NUMBER, not the form's name or id.
const DEFAULT_FORM_NUMBER = '1';
export default function CognitoFormEmbed({
  formId = import.meta.env.VITE_COGNITO_INTAKE_FORM_ID || DEFAULT_FORM_NUMBER,
  formNumber,
  accountKey = import.meta.env.VITE_COGNITO_ACCOUNT_KEY,
  compact = false,
  tight = false,
  prefill = null,
}) {
  // `formNumber` (when passed) is authoritative — no env fallback. Campaign
  // mounts (e.g. /vitalice) use this so a missing env fails closed to the
  // phone card instead of silently routing to Avalon Intake.
  const resolvedFormId = formNumber !== undefined ? formNumber : formId;
  const mountRef = useRef(null);
  const trackedRef = useRef(false);
  const safePrefill = useMemo(() => sanitizeCognitoPrefill(prefill), [prefill]);

  // Anonymous, propertyless, fire-once. There is deliberately no submit event:
  // observing a submission means reading the form, and an unreliable funnel
  // number is not worth touching patient fields.
  const trackLoadedOnce = useCallback(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    track(ANALYTICS_EVENTS.COGNITO_FORM_LOADED);
  }, []);

  useEffect(() => {
    if (!resolvedFormId || !accountKey) return undefined;
    const host = mountRef.current;
    if (!host) return undefined;

    // seamless.js replaces itself in place with the rendered form, so it has
    // to be appended into the mount node rather than <head>.
    host.replaceChildren();
    const script = document.createElement('script');
    script.src = SEAMLESS_SRC;
    script.async = true;
    script.setAttribute('data-key', accountKey);
    script.setAttribute('data-form', String(resolvedFormId));
    const handleLoad = () => {
      trackLoadedOnce();
      if (!Object.keys(safePrefill).length) return;
      try { window.Cognito?.prefill?.(safePrefill); } catch { /* form stays usable without prefill */ }
    };
    script.addEventListener('load', handleLoad);
    host.appendChild(script);

    return () => {
      script.removeEventListener('load', handleLoad);
      // Tear the form out on unmount so no patient-entered value survives a
      // client-side navigation in a detached node.
      host.replaceChildren();
    };
  }, [resolvedFormId, accountKey, safePrefill, trackLoadedOnce]);

  // Fail closed. A build with missing config shows a phone number, never a
  // "temporary" name/phone form of our own — that exact shortcut is how this
  // component ended up collecting PHI on Avalon's servers in the first place.
  // Only Cognito's script may create fields here. If you are here to make the
  // flow testable without provisioning: don't. Provision the form.
  if (!resolvedFormId || !accountKey) {
    return (
      <div
        data-testid="cognito-unavailable"
        className="rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-6"
      >
        <p className="font-body text-sm font-semibold text-foreground/80">
          Form failed to load. Please refresh, or reach us at (415) 980-7708.
        </p>
      </div>
    );
  }

  // `cognito` is the styling hook. The skin lives in src/index.css — Cognito's
  // own rules are authored at :root:root:root:root:root specificity, so that
  // block is where the design is enforced, not here.
  return (
    <div
      ref={mountRef}
      data-testid="cognito-embed"
      className={`cognito${compact ? ' cognito--compact' : ''}${tight ? ' cognito--tight' : ''}`}
    />
  );
}
