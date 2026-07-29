import { useEffect, useRef, useState } from 'react';

// Cognito Forms embed wrapper.
//
// - When `formId` or `accountKey` is falsy, renders a placeholder card with a
//   "Simulate submit" button so the intake flow can be walked end-to-end
//   without provisioning.
// - When both are set, drops Cognito's seamless.js <script> into the container
//   (the script replaces itself with the form iframe at that spot) and calls
//   `onSubmit()` when a postMessage from cognitoforms.com signals a submit.
//
// Pre-ship gate: the connected Cognito form MUST be on the HIPAA plan with a
// BAA in place before this component accepts real PHI. Set the ids via
// VITE_COGNITO_INTAKE_FORM_ID and VITE_COGNITO_ACCOUNT_KEY at build time.

const SEAMLESS_SRC = 'https://www.cognitoforms.com/f/seamless.js';

export default function CognitoFormEmbed({
  formId = import.meta.env.VITE_COGNITO_INTAKE_FORM_ID,
  accountKey = import.meta.env.VITE_COGNITO_ACCOUNT_KEY,
  onSubmit,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  buttonLabel = 'Continue',
  compact = false,
  tight = false,
  nameTestId = 'cognito-name',
  phoneTestId = 'cognito-phone',
  submitTestId = 'cognito-simulate-submit',
}) {
  const mountRef = useRef(null);
  const [loadError, setLoadError] = useState(false);
  const [previewName, setPreviewName] = useState('');
  const [previewPhone, setPreviewPhone] = useState('');

  useEffect(() => {
    if (!formId || !accountKey) return undefined;
    const host = mountRef.current;
    if (!host) return undefined;

    host.innerHTML = '';
    const script = document.createElement('script');
    script.src = SEAMLESS_SRC;
    script.async = true;
    script.setAttribute('data-key', accountKey);
    script.setAttribute('data-form', formId);
    script.onerror = () => setLoadError(true);
    host.appendChild(script);

    const onMessage = (event) => {
      if (event.origin !== 'https://www.cognitoforms.com') return;
      const data = event.data;
      const type = typeof data === 'string' ? data : data?.type || data?.event;
      if (typeof type === 'string' && /submit|success|thankyou/i.test(type)) {
        onSubmit?.();
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (host) host.innerHTML = '';
    };
  }, [formId, accountKey, onSubmit]);

  if (!formId || !accountKey) {
    const resolvedName = name ?? previewName;
    const resolvedPhone = phone ?? previewPhone;
    const setResolvedName = onNameChange || setPreviewName;
    const setResolvedPhone = onPhoneChange || setPreviewPhone;
    const canSubmit = resolvedName.trim().length > 0 && resolvedPhone.trim().length >= 7;

    return (
      <form
        aria-label="Cognito contact form placeholder"
        data-cognito-placeholder="true"
        className={tight
          ? 'grid gap-3.5'
          : compact
          ? 'grid gap-5'
          : 'grid gap-5 rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-6'}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit?.();
        }}
      >
        <label className="block">
          <span className={`${tight ? 'mb-1.5 text-[11px]' : 'mb-2 text-[13px]'} block font-body font-bold uppercase tracking-[0.12em] text-foreground/55`}>
            Your name
          </span>
          <input
            type="text"
            name="full_name"
            autoComplete="name"
            value={resolvedName}
            onChange={(event) => setResolvedName(event.target.value)}
            placeholder="Full name"
            data-testid={nameTestId}
            className={`${tight ? 'rounded-xl px-4 py-3 text-[15px]' : 'rounded-2xl px-5 py-4 text-base'} w-full border border-foreground/[0.18] bg-transparent font-body font-medium text-foreground placeholder:text-foreground/35 focus:border-foreground/60 focus:outline-none`}
          />
        </label>
        <label className="block">
          <span className={`${tight ? 'mb-1.5 text-[11px]' : 'mb-2 text-[13px]'} block font-body font-bold uppercase tracking-[0.12em] text-foreground/55`}>
            Mobile number
          </span>
          <input
            type="tel"
            name="mobile_number"
            inputMode="tel"
            autoComplete="tel"
            value={resolvedPhone}
            onChange={(event) => setResolvedPhone(event.target.value)}
            placeholder="(415) 000-0000"
            data-testid={phoneTestId}
            className={`${tight ? 'rounded-xl px-4 py-3 text-[15px]' : 'rounded-2xl px-5 py-4 text-base'} w-full border border-foreground/[0.18] bg-transparent font-body font-medium text-foreground placeholder:text-foreground/35 focus:border-foreground/60 focus:outline-none`}
          />
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          data-testid={submitTestId}
          className={`${tight ? 'min-h-11' : 'min-h-12'} inline-flex items-center justify-center rounded-full bg-foreground px-6 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-background transition disabled:cursor-not-allowed disabled:opacity-30`}
        >
          {buttonLabel}
        </button>
      </form>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03] p-6">
        <p className="font-body text-sm font-semibold text-foreground/80">
          Form failed to load. Please refresh, or reach us at (415) 980-7708.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="cognito overflow-hidden rounded-2xl border border-foreground/[0.12] bg-foreground/[0.03]"
    />
  );
}
