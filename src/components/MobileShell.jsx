import { useLocation } from 'react-router-dom';
import AvalonStaticBackdrop from '@/components/AvalonStaticBackdrop';
import CornerMenuHeader from '@/components/landing/CornerMenuHeader';

// Signage/kiosk surfaces are chrome-free: a Guided-Access iPad must not offer
// nav escape routes, and the departures board is pure-black signage.
// /vitalice is chrome-free too — it carries its own in-page co-brand ribbon
// (Vital Ice × Avalon Vitality) and a full-bleed glacier hero, so the global
// AVALON VITALITY header would double-brand and eat vertical space above the
// ribbon.
const CHROME_FREE = /^\/(?:vitalice|events\/[^/]+\/(kiosk|board))\/?$/;
const INTERNAL_CHROME_FREE = /^\/(?:admin|provider|members|organizer)(?:\/|$)/;
const CURRENT_CONSUMER_SURFACES = [
  /^\/$/,
  /^\/(?:nurse-delivery|protocols|subscription)(?:\/|$)/,
  /^\/products(?:\/|$)/,
  /^\/(?:events|launches)\/?$/,
];

export default function MobileShell() {
  const { pathname } = useLocation();
  if (CHROME_FREE.test(pathname) || INTERNAL_CHROME_FREE.test(pathname)) return null;

  const currentConsumerSurface = CURRENT_CONSUMER_SURFACES.some((pattern) => pattern.test(pathname));
  const preserveLegacyBackdrop = pathname !== '/' && !currentConsumerSurface;

  return (
    <>
      {preserveLegacyBackdrop ? <AvalonStaticBackdrop /> : null}
      <div className="nd-global-corner-header">
        <CornerMenuHeader />
      </div>
      {currentConsumerSurface ? <div className="nd-global-corner-header__spacer" aria-hidden="true" /> : null}
    </>
  );
}
