import React from 'react';
import { Home, CalendarCheck, Menu, Crown } from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';

const TABS = [
  { to: '/',             label: 'Home',     icon: Home,          exact: true },
  { to: '/book',         label: 'Book',     icon: CalendarCheck, primary: true },
  { to: '/protocols',    label: 'Protocol', icon: Menu },
  { to: '/subscription', label: 'Plan',     icon: Crown },
];

export default function BottomNav() {
  return (
    <MobileNavBar
      items={TABS}
      ariaLabel="Mobile navigation"
      columns={4}
    />
  );
}
