import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Instagram } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import ScrollParallax from '@/components/ui/ScrollParallax';
import { PLACEHOLDER_POSTS, IG_HANDLE_URL } from './InstagramFeed.data.js';

const IG_HANDLE = 'avalon_vitality';
const IG_EMBED_URL = `https://www.instagram.com/${IG_HANDLE}/embed/`;
const IG_LIMIT = 30;
const IG_REFRESH_MS = 15 * 60 * 1000;

// Instagram's anonymous profile SPA fails with "Something went wrong" for
// many logged-out sessions (documented Meta authwall since 2023). Deep-link
// to the IG app on mobile; fall back to the /embed/ route on desktop, which
// is the only Meta-sanctioned URL that renders anonymously.
function openInstagram(event) {
  if (event) event.preventDefault();
  if (typeof window === 'undefined') return;
  const ua = (window.navigator && window.navigator.userAgent) || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const web = `https://www.instagram.com/${IG_HANDLE}/`;
  if (isIOS) {
    const t = window.setTimeout(() => { window.location.href = web; }, 700);
    window.addEventListener('pagehide', () => window.clearTimeout(t), { once: true });
    window.location.href = `instagram://user?username=${IG_HANDLE}`;
    return;
  }
  if (isAndroid) {
    window.location.href = `intent://instagram.com/${IG_HANDLE}/#Intent;package=com.instagram.android;scheme=https;end`;
    return;
  }
  window.open(IG_EMBED_URL, '_blank', 'noopener,noreferrer');
}

function useLiveInstagramFeed(fallback) {
  const [posts, setPosts] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/instagram-feed', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data?.posts) && data.posts.length > 0) {
          setPosts(data.posts.slice(0, IG_LIMIT));
        }
      } catch { /* keep fallback */ }
    }
    load();
    const timer = setInterval(load, IG_REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  return posts;
}

// One tile in the marquee. No caption chrome — clean image only.
function RibbonTile({ post }) {
  return (
    <a
      href={post.permalink}
      onClick={openInstagram}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open Instagram post: ${post.caption}`}
      className="group relative block h-[180px] w-[180px] shrink-0 overflow-hidden rounded-[1.25rem] border border-white/[0.12] transition-colors duration-500 ease-editorial hover:border-white/[0.24]"
    >
      <img
        src={post.imageUrl}
        alt={post.caption}
        loading="lazy"
        decoding="async"
        draggable="false"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span
        aria-hidden="true"
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center text-white/70"
      >
        <Instagram className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
    </a>
  );
}

export default function InstagramFeed({ posts: initialPosts = PLACEHOLDER_POSTS, handleUrl = IG_HANDLE_URL }) {
  const [hoverPaused, setHoverPaused] = useState(false);
  const [mobileDragging, setMobileDragging] = useState(false);
  const [mobileHovered, setMobileHovered] = useState(false);
  const mobileScrollerRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const reduce = useReducedMotion();
  const posts = useLiveInstagramFeed(initialPosts);

  // Cap source at 30 (most-recent). Marquee doubles the strip for a seamless
  // loop; if the source is short, we repeat it up to IG_LIMIT so the strip
  // always has 30 tiles before doubling — no visible reset.
  const seed = posts.length ? posts : PLACEHOLDER_POSTS;
  const source = Array.from({ length: IG_LIMIT }, (_, i) => seed[i % seed.length]).slice(0, IG_LIMIT);
  const loop = [...source, ...source];

  const isRunning = !hoverPaused && !reduce;
  const mobileInteractionPaused = mobileDragging || mobileHovered;

  useEffect(() => {
    if (reduce || mobileInteractionPaused || typeof window === 'undefined') return undefined;

    const scroller = mobileScrollerRef.current;
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    if (!scroller || !mobileQuery.matches) return undefined;

    let frameId;
    let previousTime = window.performance.now();
    let position = scroller.scrollLeft;
    const pixelsPerSecond = 14;

    const move = (time) => {
      // Clamp elapsed time so returning to a backgrounded tab never causes a jump.
      const elapsed = Math.min(time - previousTime, 64);
      previousTime = time;
      const loopWidth = scroller.scrollWidth / 2;

      if (loopWidth > 0) {
        // Keep the fractional position in JavaScript. Some mobile engines
        // round scrollLeft assignments to whole pixels; adding ~0.23px to the
        // DOM value every frame would otherwise round almost all movement away.
        position += (pixelsPerSecond * elapsed) / 1000;
        if (position >= loopWidth) position -= loopWidth;
        scroller.scrollLeft = position;
      }

      frameId = window.requestAnimationFrame(move);
    };

    frameId = window.requestAnimationFrame(move);
    return () => window.cancelAnimationFrame(frameId);
  }, [mobileInteractionPaused, reduce]);

  useEffect(() => () => window.clearTimeout(resumeTimerRef.current), []);

  const pauseForDrag = () => {
    window.clearTimeout(resumeTimerRef.current);
    setMobileDragging(true);
  };

  const resumeAfterDrag = () => {
    window.clearTimeout(resumeTimerRef.current);
    // Let native touch momentum finish before the automatic movement resumes.
    resumeTimerRef.current = window.setTimeout(() => setMobileDragging(false), 1000);
  };

  return (
    <section id="instagram" className="pt-10 pb-10 md:pt-16 md:pb-16 scroll-mt-20 overflow-hidden">
      {/* Header — content-column width */}
      <div className="max-w-6xl mx-auto px-4">
        <ScrollParallax className="mb-6 md:mb-8">
          <div className="min-w-0">
            <p
              className="mb-2 font-body text-[11px] uppercase leading-relaxed tracking-[0.22em] text-foreground/55 md:text-xs"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              @avalon_vitality
            </p>
            <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl text-foreground uppercase tracking-tight leading-[0.92]">
              Live from the field
            </h2>
          </div>
        </ScrollParallax>
      </div>

      {/* Marquee ribbon. iOS Safari fix bundle:
          - Plain <div> instead of motion.div (framer's whileInView can leave
            opacity at 0 on some IntersectionObserver races).
          - No CSS mask — WebKit software-renders masked subtrees.
          - Extra layer-promoting wrapper (translateZ(0) + will-change) so the
            animation lives on its own compositor layer.
          - Edge fades are gradient overlays outside the animated pipeline. */}
      <div
        className="av-ig-marquee relative hidden w-full overflow-hidden md:block"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        <div
          className="av-ig-strip-wrap"
          style={{ transform: 'translateZ(0)', willChange: 'transform', WebkitTransform: 'translateZ(0)' }}
        >
          <div
            className="flex w-max gap-2 av-ig-strip"
            style={{
              animation: 'av-ig-marquee 150s linear infinite',
              WebkitAnimation: 'av-ig-marquee 150s linear infinite',
              animationPlayState: isRunning ? 'running' : 'paused',
              WebkitAnimationPlayState: isRunning ? 'running' : 'paused',
              willChange: 'transform',
              transform: 'translate3d(0,0,0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {loop.map((post, i) => (
              <RibbonTile key={`${post.id}-${i}`} post={post} />
            ))}
          </div>
        </div>

        {/* Edge fades — gradient overlays instead of CSS mask. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-24 bg-gradient-to-r from-black to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-24 bg-gradient-to-l from-black to-transparent" />

        <style>{`
          @keyframes av-ig-marquee {
            0%   { -webkit-transform: translate3d(0, 0, 0); transform: translate3d(0, 0, 0); }
            100% { -webkit-transform: translate3d(-50%, 0, 0); transform: translate3d(-50%, 0, 0); }
          }
          @-webkit-keyframes av-ig-marquee {
            0%   { -webkit-transform: translate3d(0, 0, 0); }
            100% { -webkit-transform: translate3d(-50%, 0, 0); }
          }
        `}</style>
      </div>

      {/* Mobile uses a native scroll surface so the ribbon can be swiped. The
          two identical groups make the slow automatic scroll loop seamlessly. */}
      <div className="relative w-full md:hidden">
        <div
          ref={mobileScrollerRef}
          className="av-ig-mobile-scroller overflow-x-auto"
          aria-label="Avalon Vitality Instagram posts"
          onPointerDown={pauseForDrag}
          onPointerUp={resumeAfterDrag}
          onPointerCancel={resumeAfterDrag}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setMobileHovered(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setMobileHovered(false);
          }}
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            scrollbarWidth: 'none',
          }}
        >
          <div className="flex w-max select-none">
            {[0, 1].map((group) => (
              <div key={group} className="flex gap-2 pr-2" aria-hidden={group === 1 ? 'true' : undefined}>
                {source.map((post, i) => (
                  <RibbonTile key={`${group}-${post.id}-${i}`} post={post} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black to-transparent" />

        <style>{`
          .av-ig-mobile-scroller::-webkit-scrollbar { display: none; }
        `}</style>
      </div>

      {/* Hairline separator + FOLLOW pill */}
      <div className="max-w-6xl mx-auto px-4 mt-8 md:mt-10">
        <div className="border-t border-white/[0.12]" />
        <div className="mt-6">
          <motion.a
            href={handleUrl}
            onClick={openInstagram}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={premiumHover}
            whileTap={premiumTap}
            className="group inline-flex items-center gap-2 rounded-full border border-white/[0.18] bg-white/[0.04] px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.22em] text-foreground/85 transition-colors duration-base ease-editorial hover:border-white/[0.32] hover:text-foreground"
          >
            Follow
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </motion.a>
        </div>
      </div>
    </section>
  );
}
