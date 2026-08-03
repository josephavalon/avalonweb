// Host-scoped "front door" gate.
//
// snooches.avalonvitality.co is the PHI-free front door: a static brochure plus
// the Cognito-hosted intake. Every legacy route that collects name / DOB /
// address / emergency contact and posts to Stripe + Supabase must be
// unreachable there, so that host stays out of PHI scope.
//
// IMPORTANT: the apex (avalonvitality.co) and www MUST NOT be listed here.
// Those hosts are handled by CareAcuityForward and their behavior is unchanged.
// A guard script asserts this set contains only the front-door host.
const FRONT_DOOR_HOSTS = new Set([
  'snooches.avalonvitality.co',
]);

export function isFrontDoorHost() {
  if (typeof window === 'undefined') return false;
  if (FRONT_DOOR_HOSTS.has(window.location.hostname)) return true;
  try {
    // ?frontdoor=1 previews the gate on any host; ?frontdoor=0 turns it back
    // off. The escape hatch is deliberate — CareAcuityForward's ?care=1 has no
    // way out, which traps the session. Don't inherit that bug.
    if (window.location.search.includes('frontdoor=1')) {
      window.sessionStorage?.setItem('front-door-preview', '1');
      return true;
    }
    if (window.location.search.includes('frontdoor=0')) {
      window.sessionStorage?.removeItem('front-door-preview');
      return false;
    }
    if (window.sessionStorage?.getItem('front-door-preview') === '1') return true;
  } catch { /* private mode etc. */ }
  return false;
}

// Consume ?frontdoor=1 / ?frontdoor=0 on whatever route the visitor lands on.
//
// Without this, the preview flag only arms when FrontDoorRedirect mounts — and
// that only happens on GATED routes. Landing on an ungated route with the flag
// (e.g. /start?frontdoor=1, the most natural thing to try) silently did nothing,
// so the next gated route rendered normally and the gate looked broken when it
// wasn't. Call this once at boot. No-op on real front-door hosts, which match on
// hostname regardless.
export function armFrontDoorPreview() {
  isFrontDoorHost();
}

export default isFrontDoorHost;
