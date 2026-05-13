/**
 * Reveal — scroll-triggered animation primitives for Avalon Vitality
 *
 * Usage:
 *   <Reveal>...</Reveal>                         single element
 *   <RevealGroup stagger={0.09}>                 stagger container
 *     <RevealItem>...</RevealItem>               stagger child
 *   </RevealGroup>
 *
 * All variants use the Avalon easing: cubic-bezier(0.16, 1, 0.3, 1)
 * viewport once:true — plays once, never re-fires on scroll back
 *
 * iOS scroll safety:
 *   - blur is FALSE by default. filter:blur() forces a new compositing layer in
 *     WebKit and causes invisible off-screen elements to eat touch events.
 *   - pointerEvents:'none' in initial state prevents opacity:0 sections from
 *     intercepting scroll gestures before they animate in.
 */
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

// ── Single reveal ────────────────────────────────────────────────────────────
export function Reveal({
  children,
  className,
  delay     = 0,
  duration  = 0.8,
  y         = 52,
  scale     = 0.97,
  blur      = false,   // ← OFF by default — blur creates compositing layers that break iOS scroll
  margin    = '-60px',
  as        = 'div',
  ...rest
}) {
  const Tag = motion[as] ?? motion.div;

  return (
    <Tag
      className={className}
      initial={{
        opacity: 0,
        y,
        scale,
        pointerEvents: 'none',                        // ← don't eat touches while invisible
        ...(blur ? { filter: 'blur(6px)' } : {}),
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        scale: 1,
        pointerEvents: 'auto',
        ...(blur ? { filter: 'blur(0px)' } : {}),
      }}
      viewport={{ once: true, margin }}
      transition={{ duration, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ── Stagger container ────────────────────────────────────────────────────────
export function RevealGroup({
  children,
  className,
  stagger   = 0.09,
  delay     = 0,
  margin    = '-50px',
  as        = 'div',
  ...rest
}) {
  const Tag = motion[as] ?? motion.div;

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin }}
      variants={{
        hidden:  { pointerEvents: 'none' },
        visible: { pointerEvents: 'auto', transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ── Stagger item ─────────────────────────────────────────────────────────────
export function RevealItem({
  children,
  className,
  y        = 36,
  scale    = 0.97,
  blur     = false,   // ← OFF by default
  duration = 0.75,
  as       = 'div',
  ...rest
}) {
  const Tag = motion[as] ?? motion.div;

  return (
    <Tag
      className={className}
      variants={{
        hidden:  {
          opacity: 0,
          y,
          scale,
          pointerEvents: 'none',
          ...(blur ? { filter: 'blur(5px)' } : {}),
        },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          pointerEvents: 'auto',
          ...(blur ? { filter: 'blur(0px)' } : {}),
          transition: { duration, ease: EASE },
        },
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
