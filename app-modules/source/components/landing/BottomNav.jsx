import React from 'react';
import { Home, CalendarCheck, Menu, Crown } from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';

const FAST_BOOK_URL = '/book?fast=1&protocol=recovery&time=asap';

const TABS = [
  { to: '/',             label: 'Home',     icon: Home,          exact: true },
  { to: FAST_BOOK_URL,   label: 'Book',     icon: CalendarCheck, primary: true },
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
