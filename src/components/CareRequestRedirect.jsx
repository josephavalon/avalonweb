import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { isCareHost } from '@/lib/careHost';

// Resolve the public request destination before a legacy booking page can mount.
export default function CareRequestRedirect({ children }) {
  const [redirect] = useState(isCareHost);
  return redirect ? <Navigate to="/start" replace /> : children;
}
