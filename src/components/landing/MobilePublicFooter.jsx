import { useLocation } from 'react-router-dom';
import { isPublicChromeRoute } from '@/lib/publicChrome';
import ConsumerFooter from '@/components/landing/ConsumerFooter';

// These surfaces intentionally own the entire mobile viewport or provide
// task-specific chrome. Adding the global footer would break their focused
// no-scroll contracts rather than improve navigation.
const FOOTER_FREE_ROUTES = [
  /^\/start(?:\/|$)/,
  /^\/vitalice(?:\/|$)/,
  /^\/events\/[^/]+\/(?:kiosk|board)\/?$/,
];

export default function MobilePublicFooter() {
  const { pathname } = useLocation();
  const footerFree = FOOTER_FREE_ROUTES.some((pattern) => pattern.test(pathname));

  if (!isPublicChromeRoute(pathname) || footerFree) return null;

  return (
    <div className="nd-mobile-footer-stage">
      <ConsumerFooter globalMobile />
    </div>
  );
}
