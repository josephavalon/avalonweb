import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const HIDDEN_PREFIXES = ['/admin', '/provider'];

function hiddenRoute(pathname = '') {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function PromoStrip() {
  const { pathname } = useLocation();
  if (hiddenRoute(pathname)) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex min-h-9 items-center justify-center border-b border-foreground/10 bg-foreground text-background shadow-[0_12px_38px_rgba(0,0,0,0.18)]">
      <Link
        to="/book"
        className="flex min-h-9 w-full items-center justify-center px-3 text-center font-body text-[10px] font-black uppercase leading-tight tracking-[0.16em] md:text-xs md:tracking-[0.22em]"
      >
        <span>15% off new customers</span>
        <span className="mx-2 text-background/45">/</span>
        <span>Code VITALITY26 at checkout</span>
      </Link>
    </div>
  );
}
