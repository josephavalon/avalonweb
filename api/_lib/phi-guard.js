/**
 * Shared PHI body guard for the un-BAA'd outbound channels (Quo SMS, Resend
 * email). Neither provider has an executed HIPAA BAA, so message bodies on the
 * general-purpose channels must stay PHI-free. This is the single source of
 * truth for the runtime block-list; send-sms.js and send-email.js both use it.
 *
 * The consented-reminder paths intentionally bypass this (45 CFR §164.522) only
 * after verifying a patient's stored opt-in. See docs/PHI_DATA_FLOW.md.
 */

// If a caller ever puts PHI-shaped tokens in the body, refuse to send.
export const PHI_BODY_PATTERNS = [
  /\bappointment\b/i,
  /\bnurse\b/i,
  /\bdose|dosage\b/i,
  /\ballerg/i,
  /\bmedication/i,
  /\bdiagnos/i,
  /\bdob\b/i,
  /\bsymptom/i,
];

export function bodyContainsPhi(body) {
  const text = String(body || '');
  return PHI_BODY_PATTERNS.some((re) => re.test(text));
}
