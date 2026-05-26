import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Crown, MessageCircle, User } from 'lucide-react';
import { useCommunicationCenter } from '@/hooks/useCommunicationCenter';

const BG = 'hsl(var(--background))';
const BAR = 'hsl(var(--background) / 0.98)';
const CARD = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.12)';
const ACTIVE_BORDER = 'hsl(var(--foreground) / 0.20)';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.42)';
const TEXT = 'hsl(var(--foreground))';

export default function MemberBottomNav() {
  const { pathname } = useLocation();
  const { snapshot } = useCommunicationCenter();

  const items = [
    { icon: Home,          label: 'Home',    href: '/members/dashboard' },
    { icon: MessageCircle, label: 'Message', href: '/members/messages', badge: snapshot.unreadTotal > 0 ? snapshot.unreadTotal : null },
    { icon: Calendar,      label: 'Start',   href: '/book', primary: true },
    { icon: Crown,         label: 'Plan',    href: '/subscription' },
    { icon: User,          label: 'Account', href: '/members/account' },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 backdrop-blur-2xl"
      aria-label="Member navigation"
      style={{
        background: `linear-gradient(180deg, rgba(8,8,7,0), ${BAR} 18%)`,
        borderTop: `1px solid ${BORDER}`,
        boxShadow: '0 -18px 48px rgba(0,0,0,0.42)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
      }}
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1.5">
        {items.map((item) => (
          <MemberNavItem
            key={item.label}
            item={item}
            active={item.href !== '#' && (pathname === item.href || pathname.startsWith(`${item.href}/`))}
          />
        ))}
      </div>
    </nav>
  );
}

function MemberNavItem({ item, active }) {
  const Icon = item.icon;
  const color = item.primary ? BG : active ? TEXT : DIM;
  const labelColor = item.primary ? TEXT : active ? TEXT : MUTED;
  const background = item.primary ? 'transparent' : active ? CARD : 'transparent';
  const border = item.primary ? '1px solid transparent' : active ? `1px solid ${ACTIVE_BORDER}` : '1px solid transparent';

  return (
    <Link
      to={item.href}
      className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-[1.15rem] px-1 text-center transition-transform active:scale-[0.97]"
      style={{ background, border }}
    >
      {item.primary ? (
        <>
          <span className="flex h-9 w-11 items-center justify-center rounded-full" style={{ background: TEXT, color: BG }}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="font-body text-[9px] font-semibold uppercase leading-none tracking-[0.16em]" style={{ color: labelColor }}>
            Start
          </span>
        </>
      ) : (
        <>
          <span className="relative flex h-9 w-11 items-center justify-center rounded-full" style={{ color }}>
            <Icon className="h-5 w-5" strokeWidth={active ? 1.9 : 1.55} />
            {item.badge && (
              <span
                className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center font-body text-[8px] font-bold"
                style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--background))', padding: '0 3px' }}
              >
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </span>
          <span className="font-body text-[8px] uppercase leading-none tracking-[0.12em]" style={{ color: labelColor }}>
            {item.label}
          </span>
        </>
      )}
    </Link>
  );
}
