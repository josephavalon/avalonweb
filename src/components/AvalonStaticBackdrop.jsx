import React from 'react';
import { useLocation } from 'react-router-dom';

const HIDDEN_PREFIXES = ['/admin', '/provider', '/members', '/login', '/checkout'];
const HIDDEN_PATHS = ['/booking/confirmation'];

function shouldShowBackdrop(pathname) {
  if (HIDDEN_PATHS.includes(pathname)) return false;
  return !HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function AvalonStaticBackdrop() {
  const { pathname } = useLocation();
  if (!shouldShowBackdrop(pathname)) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black" aria-hidden="true">
      <img
        src="/images/avalon-hero.webp"
        srcSet="/images/avalon-hero-512.webp 512w, /images/avalon-hero-768.webp 768w, /images/avalon-hero.webp 1024w"
        sizes="100vw"
        alt=""
        className="absolute inset-0 h-full w-full scale-[1.32] object-cover opacity-34 blur-[3px] saturate-[0.48] brightness-[0.48]"
        style={{ objectPosition: '42% 34%' }}
        loading="eager"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-black/84" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/96 via-black/88 to-black/76" />
      <div className="absolute inset-x-0 bottom-0 h-[78svh] bg-gradient-to-t from-black via-black/96 to-black/22" />
      <div className="absolute inset-x-0 top-0 h-[38svh] bg-gradient-to-b from-black/76 via-black/42 to-transparent" />
    </div>
  );
}
