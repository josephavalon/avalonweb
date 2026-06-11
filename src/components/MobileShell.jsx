import AvalonStaticBackdrop from '@/components/AvalonStaticBackdrop';
import Navbar from '@/components/landing/Navbar';

export default function MobileShell() {
  return (
    <>
      <AvalonStaticBackdrop />
      <Navbar mobileGlobal />
    </>
  );
}
