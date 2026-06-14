/**
 * /members/messages — Client messaging page
 * Full-screen MessagingPanel for mobile; also accessible from MemberBottomNav.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/useAuthStore';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import CommunicationCenter from '@/components/messaging/CommunicationCenter';

export default function MemberMessages() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !['client', 'admin'].includes(user.role)) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: 'hsl(var(--background))' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'hsl(var(--foreground) / 0.08)', background: 'hsl(var(--background))' }}
      >
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.28em] text-foreground/40">
            Avalon OS
          </p>
          <h1 className="font-heading text-2xl uppercase leading-none text-foreground">
            Messages
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 md:pb-6 px-3 py-3">
        <CommunicationCenter compact roleOverride="client" initialTab="messages" />
      </main>

      <MemberBottomNav />
    </div>
  );
}
