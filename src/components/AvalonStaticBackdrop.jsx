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
    <div
      className="avalon-static-backdrop pointer-events-none fixed bottom-0 left-0 right-0 top-0 z-0 h-[100lvh] min-h-screen overflow-hidden bg-background"
      aria-hidden="true"
      role="presentation"
    >
      <picture>
        <source
          type="image/avif"
          srcSet="/images/avalon-static-back-512.avif 512w, /images/avalon-static-back-1024.avif 1024w, /images/avalon-static-back.avif 1536w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/images/avalon-static-back-512.webp 512w, /images/avalon-static-back-1024.webp 1024w, /images/avalon-static-back.webp 1536w"
          sizes="100vw"
        />
        <img
          src="/images/avalon-static-back.jpg"
          srcSet="/images/avalon-static-back-512.jpg 512w, /images/avalon-static-back-1024.jpg 1024w, /images/avalon-static-back.jpg 1536w"
          sizes="100vw"
          alt=""
          className="avalon-static-backdrop__image absolute inset-0 h-full w-full object-cover [object-position:86%_52%] md:[object-position:74%_52%]"
          loading="eager"
          fetchpriority="high"
        />
      </picture>
      <div className="avalon-static-backdrop__veil absolute inset-0" />
      <div className="avalon-static-backdrop__side absolute inset-0" />
      <div className="avalon-static-backdrop__bottom absolute inset-x-0 bottom-0 h-[78svh]" />
      <div className="avalon-static-backdrop__top absolute inset-x-0 top-0 h-[38svh]" />
    </div>
  );
}
