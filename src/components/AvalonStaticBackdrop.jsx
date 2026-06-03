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
    <div className="pointer-events-none fixed inset-x-0 top-0 h-screen z-0 overflow-hidden bg-black" aria-hidden="true">
      <img
        src="/images/avalon-hero-new.jpg"
        srcSet="/images/avalon-hero-new-512.jpg 512w, /images/avalon-hero-new-768.jpg 768w, /images/avalon-hero-new.jpg 1122w"
        sizes="100vw"
        alt=""
        className="absolute inset-0 h-full w-full scale-[1.0] object-cover opacity-45 blur-[2px] saturate-[0.56] brightness-[0.58] md:scale-[1.18]"
        style={{ objectPosition: '76% 34%' }}
        loading="eager"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-black/76" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/94 via-black/82 to-black/64" />
      <div className="absolute inset-x-0 bottom-0 h-[78svh] bg-gradient-to-t from-black via-black/96 to-black/22" />
      <div className="absolute inset-x-0 top-0 h-[38svh] bg-gradient-to-b from-black/76 via-black/42 to-transparent" />
    </div>
  );
}
