import AvalonStaticBackdrop from '@/components/AvalonStaticBackdrop';
import Navbar from '@/components/landing/Navbar';
import AvalonChatWidget from '@/components/landing/AvalonChatWidget';
import PromoStrip from '@/components/landing/PromoStrip';

export default function MobileShell() {
  return (
    <>
      <AvalonStaticBackdrop />
      <PromoStrip />
      <Navbar mobileGlobal />
      <AvalonChatWidget />
    </>
  );
}
