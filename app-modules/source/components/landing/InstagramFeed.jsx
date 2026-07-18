import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { ArrowRight, Instagram, Pause, Play } from 'lucide-react';
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
  const [paused, setPaused] = useState(false);
  // Marquee ignores prefers-reduced-motion — this ribbon is a decorative
  // element where motion is the point; iOS "Reduce Motion" would otherwise
  // freeze the strip entirely on many users' phones.
  const reduce = false;
  const posts = useLiveInstagramFeed(initialPosts);

  // Cap source at 30 (most-recent). Marquee doubles the strip for a seamless
  // loop; if the source is short, we repeat it up to IG_LIMIT so the strip
  // always has 30 tiles before doubling — no visible reset.
  const seed = posts.length ? posts : PLACEHOLDER_POSTS;
  const source = Array.from({ length: IG_LIMIT }, (_, i) => seed[i % seed.length]).slice(0, IG_LIMIT);
  const loop = [...source, ...source];

  const isRunning = !paused && !reduce;

  return (
    <section id="instagram" className="pt-10 pb-10 md:pt-16 md:pb-16 scroll-mt-20 overflow-hidden">
      {/* Header — content-column width */}
      <div className="max-w-6xl mx-auto px-4">
        <ScrollParallax className="mb-6 md:mb-8 flex items-end justify-between gap-4">
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

          <div className="hidden md:flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.22em] text-foreground/55 transition-colors duration-base ease-editorial hover:text-foreground"
              aria-label={paused ? 'Play marquee' : 'Pause marquee'}
            >
              {paused ? <Play className="h-3 w-3" strokeWidth={2} /> : <Pause className="h-3 w-3" strokeWidth={2} />}
              <span>{paused ? 'Play' : 'Pause'}</span>
            </button>
            <span aria-hidden="true" className="text-foreground/30">/</span>
            <ArrowRight className="h-4 w-4 text-foreground/55" strokeWidth={2} />
          </div>
        </ScrollParallax>
      </div>

      {/* Marquee ribbon — full viewport width with edge fades */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="av-ig-marquee relative w-full"
        style={{
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0, #000 96px, #000 calc(100% - 96px), transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0, #000 96px, #000 calc(100% - 96px), transparent 100%)',
        }}
      >
        <div
          className="flex w-max gap-2"
          style={{
            animation: 'av-ig-marquee 150s linear infinite',
            animationPlayState: isRunning ? 'running' : 'paused',
            willChange: 'transform',
          }}
        >
          {loop.map((post, i) => (
            <RibbonTile key={`${post.id}-${i}`} post={post} />
          ))}
        </div>

        <style>{`
          @keyframes av-ig-marquee {
            0%   { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
          }
        `}</style>
      </motion.div>

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
