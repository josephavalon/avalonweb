const CARE_HOSTS = new Set([
  'care.avalonvitality.co',
  'avalonvitality.co',
  'www.avalonvitality.co',
]);

export function isCareHost() {
  if (typeof window === 'undefined') return false;
  if (CARE_HOSTS.has(window.location.hostname)) return true;
  try {
    if (window.location.search.includes('care=1')) {
      window.sessionStorage?.setItem('care-preview', '1');
      return true;
    }
    if (window.sessionStorage?.getItem('care-preview') === '1') return true;
  } catch { /* private mode etc. */ }
  return false;
}
