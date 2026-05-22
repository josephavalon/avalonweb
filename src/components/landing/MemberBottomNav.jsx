import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Droplets, Calendar, Crown, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BG = '#080807';
const BAR = 'rgba(13,12,10,0.98)';
const CARD = 'rgba(245,235,221,0.075)';
const BORDER = 'rgba(245,235,221,0.12)';
const ACTIVE_BORDER = 'rgba(245,235,221,0.20)';
const MUTED = 'rgba(245,235,221,0.62)';
const DIM = 'rgba(245,235,221,0.36)';
const TEXT = '#F5EBDD';

export default function MemberBottomNav() {
  const { toast } = useToast();
  const { pathname } = useLocation();

  const items = [
    { icon: Home,     label: 'Home',       href: '/members/dashboard' },
    { icon: Droplets, label: 'Store',      href: '/store' },
    { icon: Calendar, label: 'Start',      href: '/store', primary: true },
    { icon: Crown,    label: 'Subscription', href: '/subscription' },
    { icon: User,     label: 'Account',    href: '#', onClick: () => toast({ title: 'Coming Soon', description: 'Account settings launching soon.' }) },
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
      onClick={item.onClick ? (e) => { e.preventDefault(); item.onClick(); } : undefined}
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
          <span className="flex h-9 w-11 items-center justify-center rounded-full" style={{ color }}>
            <Icon className="h-5 w-5" strokeWidth={active ? 1.9 : 1.55} />
          </span>
          <span className="font-body text-[8px] uppercase leading-none tracking-[0.12em]" style={{ color: labelColor }}>
            {item.label}
          </span>
        </>
      )}
    </Link>
  );
}
