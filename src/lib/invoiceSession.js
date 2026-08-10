/**
 * The nurse invoice session, in one place.
 *
 * It lives here rather than inside the invoice page because the global corner
 * menu needs to read it too — the menu's last item is Login when signed out and
 * Log out when signed in, and a header importing from a page module would be
 * the wrong direction of dependency.
 *
 * sessionStorage, not localStorage: a shared phone or iPad must not stay signed
 * in once the tab closes.
 */
export const INVOICE_TOKEN_KEY = 'av.invoice.token';
export const INVOICE_DRAFT_KEY = 'av.invoice.draft';

export function readInvoiceToken() {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(INVOICE_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function isInvoiceSignedIn() {
  return Boolean(readInvoiceToken());
}

export function storeInvoiceToken(token) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(INVOICE_TOKEN_KEY, token);
  } catch {
    /* private mode — the token still lives in memory for this session */
  }
}

/**
 * Clears the draft as well as the token. On a shared phone the next person must
 * not inherit a half-filled invoice carrying someone else's shifts.
 */
export function clearInvoiceSession() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(INVOICE_TOKEN_KEY);
    window.sessionStorage.removeItem(INVOICE_DRAFT_KEY);
  } catch {
    /* nothing was persisted to clear */
  }
}
