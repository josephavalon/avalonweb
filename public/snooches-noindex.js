// Any non-prod staging host (snooches or beta) must not be indexed. The apex
// avalonvitality.co (coming-soon) has its own robots policy.
if (location.hostname === 'snooches.avalonvitality.co' || location.hostname === 'beta.avalonvitality.co' || location.hostname === 'care.avalonvitality.co') {
  document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex, nofollow, noarchive');
}
