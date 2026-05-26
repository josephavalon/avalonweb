import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, CalendarCheck, Menu, Crown } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';

const EASE = [0.16, 1, 0.3, 1];

const TABS = [
  { to: '/',            label: 'Home',      icon: Home         },
  { to: '/book',        label: 'Book',      icon: CalendarCheck },
  { to: '/protocols',   label: 'Protocol',  icon: Menu         },
  { to: '/subscription',label: 'Plan',      icon: Crown       },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <motion.nav
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: EASE, delay: 0.2 }}
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.55rem)' }}
    >
      <div className="mx-3 rounded-[24px] border border-foreground/[0.10] bg-background/82 p-1.5 backdrop-blur-2xl shadow-[0_-18px_54px_rgba(0,0,0,0.34)]">
        <div className="grid grid-cols-4 gap-1">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl transition-transform active:scale-[0.96]"
              >
                <motion.div
                  animate={{ scale: active ? 1 : 0.92, opacity: active ? 1 : 0.45 }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className={`flex flex-col items-center gap-0.5 ${active ? 'text-foreground' : 'text-foreground/45'}`}
                >
                  <div className={`relative flex h-9 w-11 items-center justify-center rounded-2xl transition-colors duration-200 ${active ? 'bg-foreground/[0.09] ring-1 ring-foreground/[0.12]' : ''}`}>
                    <Icon className="w-4 h-4" strokeWidth={active ? 2 : 1.6} />
                  </div>
                  <span className={`font-body text-[9px] tracking-[0.1em] uppercase leading-none transition-colors ${active ? 'text-foreground' : 'text-foreground/40'}`}>
                    {label}
                  </span>
                </motion.div>
              </NavLink>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
