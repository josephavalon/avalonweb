import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isFrontDoorHost } from '@/lib/frontDoor';

// Per-route gate. On the front-door host every PHI-collecting route bounces to
// /start (the Cognito-hosted intake) instead of mounting the legacy funnel.
//
// The host read is taken once via useState initializer so the very first render
// is already correct — same technique as CareRequestRedirect — which means the
// gated page component never mounts and never fires its effects.
//
// CareRequestRedirect stays outermost on legacy booking routes so public
// visitors reach /start without mounting either legacy intake or its effects.
export default function FrontDoorRedirect({ children, to = '/start' }) {
  const [gated] = useState(isFrontDoorHost);
  if (gated) return <Navigate to={to} replace />;
  return children;
}
