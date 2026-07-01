import React, { useEffect, useRef } from 'react';
import { animate, createDrawable, stagger } from 'animejs';

// Hero IV bag — anime.js timeline:
//   1. Bag outline + hanger draw in (stroke draw)
//   2. Liquid fills bag from bottom (mask rect animates up)
//   3. Drip chamber half-fill + a single droplet pulses on infinite loop
// Respects prefers-reduced-motion → renders static, fully filled.
export default function HeroIVBag({ className = '', startDelay = 200 }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const root = rootRef.current;
    if (!root) return;

    const liquid = root.querySelector('#iv-liquid-rect');
    const chamberLiquid = root.querySelector('#iv-chamber-liquid');
    const droplet = root.querySelector('#iv-droplet');
    const strokes = root.querySelectorAll('.iv-stroke');

    if (reduce) {
      if (liquid) liquid.setAttribute('y', '38');
      if (chamberLiquid) chamberLiquid.setAttribute('height', '8');
      if (droplet) droplet.style.opacity = '0';
      return;
    }

    // 1) Stroke draw — anime.js v4 createDrawable returns drawable wrappers
    const drawables = createDrawable(strokes);
    animate(drawables, {
      draw: ['0 0', '0 1'],
      duration: 1100,
      delay: stagger(55, { start: startDelay }),
      ease: 'inOutQuad',
    });

    // 2) Liquid fills the bag (mask rect Y rises from 168 → 38)
    if (liquid) {
      animate(liquid, {
        y: [{ from: 168, to: 38 }],
        duration: 1500,
        delay: startDelay + 600,
        ease: 'inOutSine',
      });
    }

    // 3) Drip chamber pool fills to half
    if (chamberLiquid) {
      animate(chamberLiquid, {
        height: [{ from: 0, to: 8 }],
        duration: 500,
        delay: startDelay + 1900,
        ease: 'outQuad',
      });
    }

    // 4) Looping droplet pulse — starts once the chamber pool is visible
    const dropletTimer = setTimeout(() => {
      if (!droplet) return;
      animate(droplet, {
        cy: [{ from: 198, to: 214 }],
        opacity: [
          { to: 1, duration: 80 },
          { to: 1, duration: 240 },
          { to: 0, duration: 80 },
        ],
        duration: 900,
        loop: true,
        ease: 'inQuad',
      });
    }, startDelay + 2300);

    return () => {
      clearTimeout(dropletTimer);
    };
  }, [startDelay]);

  // Stroke + fill driven by CSS so it adopts theme color (text-foreground)
  const stroke = 'currentColor';
  const fillSubtle = 'rgba(255,255,255,0.07)';
  const fillLiquid = 'rgba(180, 210, 255, 0.55)';

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ color: 'currentColor', filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.35))' }}
    >
      <svg
        viewBox="0 0 240 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ width: '100%', height: '100%', overflow: 'visible' }}
      >
        <defs>
          <clipPath id="iv-bag-clip">
            {/* Bag body shape (rounded with shoulder) */}
            <path d="M70 44 Q70 36 78 36 L162 36 Q170 36 170 44 L170 196 Q170 212 154 212 L86 212 Q70 212 70 196 Z" />
          </clipPath>
          <linearGradient id="iv-liquid-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(190, 220, 255, 0.65)" />
            <stop offset="100%" stopColor="rgba(140, 180, 240, 0.45)" />
          </linearGradient>
        </defs>

        {/* Hanger loop */}
        <path
          className="iv-stroke"
          d="M120 8 C 108 8 108 22 120 22 C 132 22 132 8 120 8 Z"
          stroke={stroke}
          strokeWidth="1.6"
        />
        {/* Hanger connector */}
        <line className="iv-stroke" x1="120" y1="22" x2="120" y2="36" stroke={stroke} strokeWidth="1.6" />

        {/* Bag body outline */}
        <path
          className="iv-stroke"
          d="M70 44 Q70 36 78 36 L162 36 Q170 36 170 44 L170 196 Q170 212 154 212 L86 212 Q70 212 70 196 Z"
          stroke={stroke}
          strokeWidth="1.8"
          fill={fillSubtle}
        />

        {/* Liquid fill — clipped to bag shape, animated by moving its top edge up */}
        <g clipPath="url(#iv-bag-clip)">
          <rect
            id="iv-liquid-rect"
            x="60"
            y="168"
            width="120"
            height="180"
            fill="url(#iv-liquid-grad)"
          />
          {/* Subtle highlight on the liquid surface */}
          <rect x="60" y="38" width="120" height="2" fill="rgba(255,255,255,0.18)" clipPath="url(#iv-bag-clip)" />
        </g>

        {/* Volume markings */}
        <line className="iv-stroke" x1="84" y1="80" x2="92" y2="80" stroke={stroke} strokeWidth="1" opacity="0.55" />
        <line className="iv-stroke" x1="84" y1="120" x2="92" y2="120" stroke={stroke} strokeWidth="1" opacity="0.55" />
        <line className="iv-stroke" x1="84" y1="160" x2="92" y2="160" stroke={stroke} strokeWidth="1" opacity="0.55" />

        {/* Label band */}
        <rect
          className="iv-stroke"
          x="96"
          y="92"
          width="48"
          height="56"
          rx="3"
          stroke={stroke}
          strokeWidth="1.2"
          fill="rgba(0,0,0,0.18)"
        />
        <text
          x="120"
          y="118"
          textAnchor="middle"
          fontFamily="'Bebas Neue', sans-serif"
          fontSize="10"
          letterSpacing="0.18em"
          fill={stroke}
          opacity="0.85"
        >
          AVALON
        </text>
        <text
          x="120"
          y="132"
          textAnchor="middle"
          fontFamily="'Bebas Neue', sans-serif"
          fontSize="7"
          letterSpacing="0.22em"
          fill={stroke}
          opacity="0.55"
        >
          1000 mL
        </text>

        {/* Bottom port */}
        <line className="iv-stroke" x1="120" y1="212" x2="120" y2="220" stroke={stroke} strokeWidth="2" />

        {/* Drip chamber */}
        <rect
          className="iv-stroke"
          x="110"
          y="220"
          width="20"
          height="36"
          rx="3"
          stroke={stroke}
          strokeWidth="1.4"
          fill={fillSubtle}
        />
        {/* Drip chamber liquid (bottom pool) */}
        <rect id="iv-chamber-liquid" x="111" y="247" width="18" height="0" fill={fillLiquid} />

        {/* Droplet inside the chamber (animated cy + opacity) */}
        <ellipse
          id="iv-droplet"
          cx="120"
          cy="198"
          rx="2.4"
          ry="3.2"
          fill={fillLiquid}
          opacity="0"
        />

        {/* Tube exiting bottom of chamber */}
        <path
          className="iv-stroke"
          d="M120 256 Q 120 290 140 304 Q 160 318 188 314"
          stroke={stroke}
          strokeWidth="1.6"
          fill="none"
        />
        {/* Roller clamp */}
        <rect
          className="iv-stroke"
          x="148"
          y="299"
          width="14"
          height="8"
          rx="2"
          stroke={stroke}
          strokeWidth="1.2"
          fill={fillSubtle}
        />
      </svg>
    </div>
  );
}
