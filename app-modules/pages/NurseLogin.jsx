import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useSeo } from '@/lib/seo';
import InvoiceUnlock, { INVOICE_TOKEN_KEY } from './invoice/InvoiceUnlock';

/**
 * /nurse-login — the "Login" item at the bottom of the front-door menu.
 *
 * Deliberately thin: it is the door to /invoice and nothing else. The gate
 * itself lives in InvoiceUnlock + api/invoice/unlock.js, so this page holds no
 * credential logic of its own.
 *
 * Not to be confused with /login, which is the Avalon OS sign-in and is wrapped
 * in FrontDoorRedirect (it bounces to /start on the apex). This one has to work
 * on the apex, which is why it is a separate route rather than a role param.
 *
 * Like /invoice, this page collects no PHI — see the header of NurseInvoice.jsx.
 */
export default function NurseLogin() {
  const navigate = useNavigate();

  useSeo({
    title: 'Nurse Login — Avalon Vitality',
    description: 'Sign in to submit contractor shifts and expenses.',
    path: '/nurse-login',
    robots: 'noindex, nofollow, noarchive',
  });

  // Already signed in? Don't make them do it twice.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.sessionStorage.getItem(INVOICE_TOKEN_KEY)) navigate('/invoice', { replace: true });
    } catch {
      /* private mode — just show the form */
    }
  }, [navigate]);

  return (
    <div className="app-shell relative isolate min-h-[100svh] w-full overflow-x-hidden text-foreground">
      {/* Centre the card in the space left under the fixed header rather than
          hanging it from the top — otherwise every pixel of slack piles up
          below the card and the page reads bottom-heavy on a laptop. */}
      <main className="mx-auto flex w-full max-w-5xl flex-col justify-center px-4 pb-16 pt-24 md:px-6 md:min-h-[100svh] md:pb-20 md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <InvoiceUnlock onUnlocked={() => navigate('/invoice')} />
        </motion.div>
      </main>
    </div>
  );
}
