/**
 * Analytics — typed event taxonomy for ARPM (Average Revenue Per Member)
 * attribution across verticals.
 *
 * Why typed events, why now?
 *   The platform's defensible unit economics depend on cross-modality LTV.
 *   A member who starts with IV and adds Peptides in Q3 is worth dramatically
 *   more than a single-vertical member — but only if we can measure the
 *   crossover. That requires consistent event schemas from day one, keyed by
 *   member_id and tagged with vertical_id. Retrofitting later means reindexing
 *   historical data we won't have captured.
 *
 * Design rules:
 *   - One funnel event = one constant. No free-form strings at callsites.
 *   - Every event carries { member_id, vertical_id } when they exist.
 *   - The track() function is fire-and-forget. It MUST NOT throw; analytics
 *     outages cannot break the UX.
 *   - No PII in event props. Emails and names stay server-side; client events
 *     carry the member_id only (generated at signup, stored locally).
 *   - FDA-safe: never log a structure/function claim as a property value.
 *     Tag with vertical_id, not with a health outcome.
 *
 * Provider swap:
 *   Call setProvider(fn) at app boot when a real destination is ready
 *   (Segment, Rudderstack, PostHog, first-party endpoint). Until then events
 *   console.log in development and queue silently in production.
 */

// --- Event constants ---------------------------------------------------------
// Lead with enum-style exports so callsites can't fat-finger event names.

export const ANALYTICS_EVENTS = Object.freeze({
  // Marketing funnel
  PAGE_VIEW: 'page_view',
  WAITLIST_SUBMITTED: 'waitlist_submitted',
  APPLY_STARTED: 'apply_started',
  APPLY_SUBMITTED: 'apply_submitted',

  // Member lifecycle — the ARPM spine.
  MEMBER_SIGNUP: 'member_signup',
  MEMBERSHIP_UPGRADE: 'membership_upgrade',
  MEMBERSHIP_DOWNGRADE: 'membership_downgrade',
  MEMBERSHIP_CANCELED: 'membership_canceled',

  // Service delivery
  DRIP_BOOKED: 'drip_booked',
  DRIP_COMPLETED: 'drip_completed',
  DRIP_CANCELED: 'drip_canceled',

  // Cross-vertical crossover — the LTV unlock.
  VERTICAL_CROSSOVER: 'vertical_crossover',
  PROTOCOL_ACTIVATED: 'protocol_activated',
  PROTOCOL_RENEWED: 'protocol_renewed',

  // Referral / growth
  REFERRAL_SENT: 'referral_sent',
  REFERRAL_CONVERTED: 'referral_converted',
});

/**
 * @typedef {Object} AnalyticsContext
 * @property {string} [member_id]     Stable member identifier (UUID).
 * @property {string} [session_id]    Per-session UUID (rotates on sign-out).
 * @property {string} [vertical_id]   Active vertical at time of event.
 */

/**
 * @typedef {Object} AnalyticsEvent
 * @property {string} name            One of ANALYTICS_EVENTS values.
 * @property {Object} props           Event-specific properties (no PII).
 * @property {number} timestamp       Unix ms.
 * @property {AnalyticsContext} context
 */

// --- Runtime state -----------------------------------------------------------

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const QUEUE_CAP = 200; // Drop oldest beyond this — prevents memory leaks.

let provider = null;
/** @type {AnalyticsEvent[]} */
const queue = [];
/** @type {AnalyticsContext} */
let context = {};

// --- Public API --------------------------------------------------------------

/**
 * Register a destination. Called once at app boot when Segment/Rudderstack/
 * etc. loads. Replays the queue synchronously so no early events are lost.
 *
 * @param {(event: AnalyticsEvent) => void} fn
 */
export function setProvider(fn) {
  provider = typeof fn === 'function' ? fn : null;
  if (provider) {
    while (queue.length) {
      const event = queue.shift();
      safeDispatch(event);
    }
  }
}

/**
 * Set or merge the ambient context applied to every subsequent event.
 * Typical shape: { member_id, session_id, vertical_id }.
 *
 * @param {AnalyticsContext} next
 */
export function setContext(next) {
  if (!next || typeof next !== 'object') return;
  context = { ...context, ...next };
}

/**
 * Clear the context — call on sign-out.
 */
export function resetContext() {
  context = {};
}

/**
 * Emit a typed event. Fire-and-forget; never throws.
 *
 * @param {string} name   One of ANALYTICS_EVENTS values.
 * @param {Object} [props]
 */
export function track(name, props = {}) {
  try {
    if (typeof name !== 'string' || !name) return;
    const event = {
      name,
      props: sanitize(props),
      timestamp: Date.now(),
      context: { ...context },
    };

    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', event.name, event.props, event.context);
    }

    if (provider) {
      safeDispatch(event);
    } else {
      queue.push(event);
      if (queue.length > QUEUE_CAP) queue.splice(0, queue.length - QUEUE_CAP);
    }
  } catch {
    // Analytics must never break the app.
  }
}

/**
 * Returns the pending (unflushed) event buffer for debugging / tests.
 * Not for production callsites.
 */
export function __peekQueue() {
  return queue.slice();
}

// --- Internals ---------------------------------------------------------------

function safeDispatch(event) {
  try {
    provider?.(event);
  } catch (err) {
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] provider threw, dropping event:', err);
    }
  }
}

// Guard against accidental PII leakage. Strip common sensitive keys at the
// boundary — event authors shouldn't have to remember.
const DROP_KEYS = new Set([
  'email',
  'first_name',
  'last_name',
  'firstName',
  'lastName',
  'phone',
  'password',
  'token',
  'ssn',
  'dob',
  'date_of_birth',
]);

function sanitize(props) {
  if (!props || typeof props !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (DROP_KEYS.has(k)) continue;
    // Truncate strings to keep payloads bounded.
    if (typeof v === 'string') {
      out[k] = v.length > 512 ? v.slice(0, 512) : v;
    } else if (v === null || ['number', 'boolean'].includes(typeof v)) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = v.slice(0, 32);
    } else if (typeof v === 'object') {
      // One level of nesting allowed; flatten further to avoid unbounded blobs.
      out[k] = JSON.parse(JSON.stringify(v)); // strip functions / refs
    }
  }
  return out;
}

// Default export mirrors the named exports for ergonomics at callsites.
const analytics = { track, setProvider, setContext, resetContext, events: ANALYTICS_EVENTS };
export default analytics;
