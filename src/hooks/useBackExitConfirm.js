import { useCallback, useEffect, useRef, useState } from 'react';

const TRAP = '__avExitTrap';

/**
 * Intercepts the browser BACK button (and iOS edge-swipe back, which also fires
 * `popstate`) so we can show an "are you sure you want to leave?" confirm before
 * the user actually navigates away.
 *
 * Mechanism: we keep exactly ONE throwaway "trap" history entry on top of the
 * current page. The first Back press pops that trap and fires `popstate`, which
 * we catch — we re-arm the trap (keeping the user on the page) and open the
 * dialog instead of leaving. Confirming exit pops past the trap and the store
 * page in one `go(-2)`.
 *
 * The trap is tagged in `history.state` so it is idempotent: React StrictMode's
 * double-invoked effects (dev) and repeated popstates never stack extra entries,
 * which keeps the `go(-2)` count correct.
 *
 * Returns { open, onKeepShopping, onExit }.
 */
export default function useBackExitConfirm() {
  const [open, setOpen] = useState(false);
  // When true, the next popstate is an intentional exit — let it pass through.
  const allowExitRef = useRef(false);

  useEffect(() => {
    const armTrap = () => {
      if (!window.history.state || !window.history.state[TRAP]) {
        window.history.pushState({ [TRAP]: true }, '');
      }
    };

    armTrap(); // same URL, nothing visibly changes

    const onPop = () => {
      if (allowExitRef.current) return; // intentional exit — don't re-arm
      armTrap(); // cancel the back by re-arming the trap
      setOpen(true);
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onKeepShopping = useCallback(() => {
    // Trap is already armed from the popstate handler; just dismiss.
    setOpen(false);
  }, []);

  const onExit = useCallback(() => {
    allowExitRef.current = true;
    setOpen(false);
    // Pop past the trap entry AND the store page to the previous location.
    window.history.go(-2);
  }, []);

  return { open, onKeepShopping, onExit };
}
