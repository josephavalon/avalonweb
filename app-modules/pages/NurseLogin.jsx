import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useSeo } from '@/lib/seo';
import InvoiceUnlock from './invoice/InvoiceUnlock';
import { isInvoiceSignedIn } from '@/lib/invoiceSession';

/**
 * /nurse-login — the shared contractor "Login" entry on the public front door.
 *
 * Deliberately thin: it is the door to /invoice and nothing else. The gate
 * itself lives in InvoiceUnlock + api/invoice/unlock.js, so this page holds no
 * credential logic of its own.
 *
 * Not to be confused with /login, which creates an Avalon OS session for an
 * individually provisioned account. This route stores only an invoice token;
 * it never creates an OS identity and cannot unlock /provider or /admin.
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
    if (isInvoiceSignedIn()) navigate('/invoice', { replace: true });
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
          <div
            role="tablist"
            aria-label="Choose staff access"
            className="mx-auto mb-5 grid w-full max-w-sm grid-cols-2 rounded-full border border-foreground/10 bg-foreground/[0.045] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className="min-h-11 rounded-full bg-foreground px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-background shadow-sm"
            >
              Nurse invoice
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={() => navigate('/admin/login')}
              className="min-h-11 rounded-full px-4 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/55 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              Admin
            </button>
          </div>
          <InvoiceUnlock onUnlocked={() => navigate('/invoice')} />
        </motion.div>
      </main>
    </div>
  );
}
