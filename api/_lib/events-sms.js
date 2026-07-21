/**
 * Queue SMS abstraction (ET8, eng review T10) — PLACEHOLDER MODE.
 *
 * The clinical queue can only text over a BAA-covered pipe. The repo's Quo
 * integration (send-sms.js) is explicitly NOT BAA-covered for SMS, so queue
 * texts route through this interface and NO real message is sent until a
 * BAA-capable provider (default: Twilio) is configured:
 *   EVENTS_SMS_PROVIDER=twilio + TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM
 *
 * Copy law (blueprint §6.3.4): operational and content-free — position and
 * "you're up," never conditions, protocols, or outcomes. TCPA consent is the
 * kiosk opt-in, recorded on the queue entry at collection time.
 *
 * Placeholder behavior (plan placeholder rule): logs the send intent to the
 * DB-safe console (no PHI in the message by construction) and returns
 * { sent: false, placeholder: true } so callers and admin UIs can label the
 * channel "SMS: placeholder mode" — the board is the fallback concierge.
 */

export const QUEUE_SMS_TEMPLATES = {
  youre_up: () => "Avalon Vitality: you're up! Please meet our clinical team at the GFE station.",
  position: ({ position }) => `Avalon Vitality: you're #${position} in line — stay close.`,
  parked: () => 'Avalon Vitality: we missed you at the station. Tap the sign-in iPad to rejoin the line.',
};

export function smsMode(env = process.env) {
  if (env.EVENTS_SMS_PROVIDER === 'twilio' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
    return 'twilio';
  }
  return 'placeholder';
}

/**
 * Send a queue SMS. template ∈ QUEUE_SMS_TEMPLATES keys; params are template
 * inputs (never free text — free-text bodies are structurally impossible).
 */
export async function sendQueueSms({ to, template, params = {}, optedIn = false, env = process.env }) {
  if (!optedIn) return { sent: false, reason: 'no_consent' };
  const render = QUEUE_SMS_TEMPLATES[template];
  if (!render) return { sent: false, reason: 'unknown_template' };
  const body = render(params);

  const mode = smsMode(env);
  if (mode === 'placeholder') {
    console.info(`[events-sms] PLACEHOLDER (not sent) template=${template} to=${String(to).slice(0, 5)}…`);
    return { sent: false, placeholder: true, mode, template, body };
  }

  // Twilio path — lands with ET8 credentials (BAA + 10DLC approved).
  try {
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: body }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[events-sms] twilio send failed status=${res.status} ${detail.slice(0, 120)}`);
      return { sent: false, mode, reason: `twilio_${res.status}` };
    }
    return { sent: true, mode, template };
  } catch (err) {
    console.warn('[events-sms] twilio send error', err?.message);
    return { sent: false, mode, reason: 'twilio_network_error' };
  }
}
