import Navbar from '@/components/landing/Navbar';
import AvalonChatWidget from '@/components/landing/AvalonChatWidget';

export default function MobileShell() {
  return (
    <>
      <Navbar mobileGlobal />
      <AvalonChatWidget />
    </>
  );
}
