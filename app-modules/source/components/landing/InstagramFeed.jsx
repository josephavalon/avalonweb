import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { Instagram } from 'lucide-react';
import ScrollParallax from '@/components/ui/ScrollParallax';
import { PLACEHOLDER_POSTS } from './InstagramFeed.data.js';

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
      className="group relative isolate block h-[180px] w-[180px] shrink-0 overflow-hidden rounded-[1.25rem] border border-white/[0.12] [contain:paint] transition-colors duration-500 ease-editorial hover:border-white/[0.24]"
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

export default function InstagramFeed({ posts: initialPosts = PLACEHOLDER_POSTS }) {
  const [hoverPaused, setHoverPaused] = useState(false);
  const [mobileDragging, setMobileDragging] = useState(false);
  const [mobileHovered, setMobileHovered] = useState(false);
  const mobileTrackRef = useRef(null);
  const mobilePositionRef = useRef(0);
  const mobileDragRef = useRef({ pointerId: null, startX: 0, startPosition: 0, moved: false });
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

    const track = mobileTrackRef.current;
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    if (!track || !mobileQuery.matches) return undefined;

    let frameId;
    let previousTime = window.performance.now();
    const pixelsPerSecond = 14;

    const move = (time) => {
      // Clamp elapsed time so returning to a backgrounded tab never causes a jump.
      const elapsed = Math.min(time - previousTime, 64);
      previousTime = time;
      const loopWidth = track.scrollWidth / 2;

      if (loopWidth > 0) {
        mobilePositionRef.current = (mobilePositionRef.current + ((pixelsPerSecond * elapsed) / 1000)) % loopWidth;
        // Use a 2D transform rather than native horizontal scrolling. This
        // keeps Safari from creating an opaque scroll layer that can repaint
        // with cached tile imagery while the user drags the ribbon.
        track.style.transform = `translateX(${-mobilePositionRef.current}px)`;
      }

      frameId = window.requestAnimationFrame(move);
    };

    frameId = window.requestAnimationFrame(move);
    return () => window.cancelAnimationFrame(frameId);
  }, [mobileInteractionPaused, reduce]);

  useEffect(() => () => window.clearTimeout(resumeTimerRef.current), []);

  const pauseForDrag = (event) => {
    window.clearTimeout(resumeTimerRef.current);
    mobileDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPosition: mobilePositionRef.current,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setMobileDragging(true);
  };

  const moveDrag = (event) => {
    const drag = mobileDragRef.current;
    const track = mobileTrackRef.current;
    if (!track || drag.pointerId !== event.pointerId) return;

    const loopWidth = track.scrollWidth / 2;
    if (loopWidth <= 0) return;

    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    mobilePositionRef.current = ((drag.startPosition - delta) % loopWidth + loopWidth) % loopWidth;
    track.style.transform = `translateX(${-mobilePositionRef.current}px)`;
  };

  const resumeAfterDrag = (event) => {
    if (mobileDragRef.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mobileDragRef.current.pointerId = null;
    window.clearTimeout(resumeTimerRef.current);
    // Leave a short beat after a swipe before the automatic movement resumes.
    resumeTimerRef.current = window.setTimeout(() => setMobileDragging(false), 1000);
  };

  const suppressDraggedClick = (event) => {
    if (!mobileDragRef.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    mobileDragRef.current.moved = false;
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
              Live
            </h2>
          </div>
        </ScrollParallax>
      </div>

      {/* Marquee ribbon. iOS Safari fix bundle:
          - Plain <div> instead of motion.div (framer's whileInView can leave
            opacity at 0 on some IntersectionObserver races).
          - No CSS mask — WebKit software-renders masked subtrees.
          - Extra layer-promoting wrapper (translateZ(0) + will-change) so the
            animation lives on its own compositor layer. */}
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

      {/* Mobile uses a transparent draggable transform track rather than an
          iOS scroll layer. The two identical groups loop seamlessly. */}
      <div className="relative w-full bg-transparent md:hidden">
        <div
          className="av-ig-mobile-scroller overflow-hidden bg-transparent"
          aria-label="Avalon Vitality Instagram posts"
          onPointerDown={pauseForDrag}
          onPointerMove={moveDrag}
          onPointerUp={resumeAfterDrag}
          onPointerCancel={resumeAfterDrag}
          onClickCapture={suppressDraggedClick}
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setMobileHovered(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setMobileHovered(false);
          }}
          style={{
            // The viewport stays a normal transparent paint surface; only the
            // child track moves, while vertical page scrolling remains native.
            backgroundColor: 'transparent',
            touchAction: 'pan-y',
          }}
        >
          <div ref={mobileTrackRef} className="flex w-max select-none bg-transparent">
            {[0, 1].map((group) => (
              <div key={group} className="flex gap-2 bg-transparent pr-2" aria-hidden={group === 1 ? 'true' : undefined}>
                {source.map((post, i) => (
                  <RibbonTile key={`${group}-${post.id}-${i}`} post={post} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}
