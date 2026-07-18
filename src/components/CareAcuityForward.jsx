import { useEffect, useState } from 'react';

const CARE_HOST = 'care.avalonvitality.co';
export const ACUITY_URL = 'https://app.acuityscheduling.com/schedule/a9d85b1e';

export function isCareHost() {
  if (typeof window === 'undefined') return false;
  if (window.location.hostname === CARE_HOST) return true;
  try {
    if (window.location.search.includes('care=1')) {
      window.sessionStorage?.setItem('care-preview', '1');
      return true;
    }
    if (window.sessionStorage?.getItem('care-preview') === '1') return true;
  } catch { /* private mode etc. */ }
  return false;
}

export default function CareAcuityForward({ children }) {
  const [forwarding] = useState(isCareHost);

  useEffect(() => {
    if (isCareHost()) window.location.replace(ACUITY_URL);
  }, []);

  if (forwarding) return null;
  return children;
}
