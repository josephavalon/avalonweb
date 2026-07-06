import { useLocation } from 'react-router-dom';
import AvalonStaticBackdrop from '@/components/AvalonStaticBackdrop';
import Navbar from '@/components/landing/Navbar';

// Signage/kiosk surfaces are chrome-free: a Guided-Access iPad must not offer
// nav escape routes, and the departures board is pure-black signage.
const CHROME_FREE = /^\/events\/[^/]+\/(kiosk|board)\/?$/;

export default function MobileShell() {
  const { pathname } = useLocation();
  if (CHROME_FREE.test(pathname)) return null;
  return (
    <>
      <AvalonStaticBackdrop />
      <Navbar globalShell />
    </>
  );
}
