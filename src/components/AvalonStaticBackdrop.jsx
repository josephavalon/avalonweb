import React from 'react';
import { useLocation } from 'react-router-dom';

const HIDDEN_PREFIXES = ['/admin', '/provider'];
const HIDDEN_PATHS = [];

function shouldShowBackdrop(pathname) {
  if (HIDDEN_PATHS.includes(pathname)) return false;
  return !HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function AvalonStaticBackdrop() {
  const { pathname } = useLocation();
  if (!shouldShowBackdrop(pathname)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 h-[100dvh] z-0 overflow-hidden bg-black" aria-hidden="true">
      <img
        src="/images/avalon-static-back.jpg"
        srcSet="/images/avalon-static-back-512.jpg 512w, /images/avalon-static-back-1024.jpg 1024w, /images/avalon-static-back.jpg 1536w"
        sizes="100vw"
        alt=""
        className="absolute inset-0 h-full w-full scale-[0.82] object-cover opacity-58 blur-[1.5px] saturate-[0.72] brightness-[0.68] [object-position:92%_52%] md:scale-[1.03] md:[object-position:74%_52%]"
        loading="eager"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-black/62" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/78 to-black/52" />
      <div className="absolute inset-x-0 bottom-0 h-[78svh] bg-gradient-to-t from-black via-black/94 to-black/18" />
      <div className="absolute inset-x-0 top-0 h-[38svh] bg-gradient-to-b from-black/72 via-black/36 to-transparent" />
    </div>
  );
}
