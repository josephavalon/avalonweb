import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Droplets, Calendar, Crown, User } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const BG     = '#0a0a08';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED  = 'rgba(240,237,228,0.55)';
const DIMMER = 'rgba(240,237,228,0.28)';
const TEXT   = '#F0EDE4';

export default function MemberBottomNav() {
  const { toast } = useToast();

  const items = [
    { icon: Home,     label: 'Home',       href: '/',           center: false },
    { icon: Droplets, label: 'Therapies',  href: '/store',      center: false },
    { icon: Calendar, label: 'Book',       href: '/store',      center: true  },
    { icon: Crown,    label: 'Membership', href: '/membership', center: false },
    { icon: User,     label: 'Account',    href: '#',           center: false, onClick: () => toast({ title: 'Coming Soon', description: 'Account settings launching soon.' }) },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-40"
      style={{ background: 'rgba(10,10,8,0.97)', borderTop: `1px solid ${BORDER}` }}>
      <div className="max-w-2xl mx-auto flex items-end justify-around px-4 pb-6 pt-2">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            onClick={item.onClick ? (e) => { e.preventDefault(); item.onClick(); } : undefined}
            className="flex flex-col items-center gap-1"
            style={{ position: 'relative', top: item.center ? '-20px' : 0 }}
          >
            {item.center ? (
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl"
                  style={{ background: TEXT, border: `3px solid ${BG}` }}>
                  <item.icon className="w-5 h-5" style={{ color: BG }} strokeWidth={2} />
                </div>
                <span className="font-body text-[9px] tracking-widest uppercase" style={{ color: MUTED }}>Start</span>
              </div>
            ) : (
              <>
                <item.icon className="w-5 h-5" style={{ color: DIMMER }} strokeWidth={1.5} />
                <span className="font-body text-[9px] tracking-widest uppercase" style={{ color: DIMMER }}>{item.label}</span>
              </>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
