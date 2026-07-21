import { useLocation } from 'react-router-dom';
import AvalonStaticBackdrop from '@/components/AvalonStaticBackdrop';
import Navbar from '@/components/landing/Navbar';

// Signage/kiosk surfaces are chrome-free: a Guided-Access iPad must not offer
// nav escape routes, and the departures board is pure-black signage.
const CHROME_FREE = /^\/events\/[^/]+\/(kiosk|board)\/?$/;
const PORTAL_CHROME_FREE = /^\/organizer(?:\/|$)/;

export default function MobileShell() {
  const { pathname } = useLocation();
  if (CHROME_FREE.test(pathname) || PORTAL_CHROME_FREE.test(pathname)) return null;
  const loginSurface = pathname === '/login' || pathname === '/admin/login';
  return (
    <>
      <AvalonStaticBackdrop />
      <div className={loginSurface ? 'hidden md:block' : undefined}>
        <Navbar globalShell />
      </div>
    </>
  );
}
