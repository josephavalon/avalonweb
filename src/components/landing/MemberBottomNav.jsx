import React from 'react';
import { Home, Calendar, Crown, MessageCircle, User } from 'lucide-react';
import { useCommunicationCenter } from '@/hooks/useCommunicationCenter';
import MobileNavBar from '@/components/navigation/MobileNavBar';

const FAST_BOOK_URL = '/book?fast=1&protocol=recovery&time=asap';

export default function MemberBottomNav() {
  const { snapshot } = useCommunicationCenter();

  const items = [
    { icon: Home,          label: 'Home', href: '/members/dashboard' },
    { icon: MessageCircle, label: 'Chat', href: '/members/messages', badge: snapshot.unreadTotal > 0 ? snapshot.unreadTotal : null },
    { icon: Calendar,      label: 'Book', href: FAST_BOOK_URL, primary: true },
    { icon: Crown,         label: 'Plan', href: '/subscription' },
    { icon: User,          label: 'Me',   href: '/members/account' },
  ];

  return (
    <MobileNavBar
      items={items.map(({ href, ...item }) => ({ ...item, to: href }))}
      ariaLabel="Member navigation"
      columns={5}
      zIndex="default"
    />
  );
}
