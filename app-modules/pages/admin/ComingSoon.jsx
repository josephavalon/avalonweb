/**
 * Admin "coming soon" placeholder. Shared target for nav items that aren't built
 * out yet (Inventory, Events, Clinical Staff, GFE, Tools, Settings). The feature
 * name comes from the ?feature query param.
 */
import { useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const BORDER = 'hsl(var(--foreground) / 0.1)';

export default function ComingSoon() {
  const [params] = useSearchParams();
  const feature = (params.get('feature') || 'This feature').trim();

  return (
    <AdminShell title={`${feature} — Coming soon`}>
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center md:py-28">
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <Sparkles className="h-6 w-6" strokeWidth={2} style={{ color: TEXT }} />
          </div>
          <h1 className="font-heading text-3xl uppercase tracking-[0.04em] md:text-4xl">{feature}</h1>
          <p className="mt-3 max-w-md font-body text-sm" style={{ color: MUTED }}>
            Coming soon. This part of the console isn&apos;t live yet — we&apos;re building it next.
            Everything you need to run bookings, payments, and your team is already available
            in the menu.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
