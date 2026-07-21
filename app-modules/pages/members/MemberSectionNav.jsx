import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, Crown, CreditCard, UserRound, FileText, LifeBuoy } from 'lucide-react';

export const MEMBER_SECTIONS = [
  { to: '/members/bookings',    label: 'Bookings',    icon: Calendar  },
  { to: '/members/memberships', label: 'Memberships', icon: Crown     },
  { to: '/members/billing',     label: 'Billing',     icon: CreditCard },
  { to: '/members/account',     label: 'Profile',     icon: UserRound  },
  { to: '/members/documents',   label: 'Documents',   icon: FileText   },
  { to: '/members/support',     label: 'Support',     icon: LifeBuoy   },
];

// Pill row of cross-section links. Used on the member dashboard and every
// sub-page so members can hop between Bookings/Memberships/Billing/Profile/Documents.
export default function MemberSectionNav() {
  return (
    <nav aria-label="Member sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {MEMBER_SECTIONS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            [
              'inline-flex min-h-[42px] shrink-0 items-center gap-2 rounded-full border px-4 font-body text-[11px] font-bold uppercase tracking-[0.18em] transition-colors',
              isActive
                ? 'border-foreground bg-foreground text-background'
                : 'border-foreground/[0.16] bg-foreground/[0.045] text-foreground/72 hover:border-foreground/30 hover:text-foreground',
            ].join(' ')
          }
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
