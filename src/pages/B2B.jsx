import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Tag, X as XIcon, Plus } from 'lucide-react';
import { B2B_PRODUCTS, COMPRESSION_ADDON, COUPONS, B2B_IV_INVENTORY, B2B_IV_SOLD, IM_SHOT_INVENTORY, IM_SHOT_SOLD } from '@/data/b2bProducts';
import { useSeo } from '@/lib/seo';

// Visual reference: baytobreakers.com (cream bg, distressed black display, pink stars,
// mint accent). Original layout. Avalon brand crossed in via the teardrop + voice.

function StarBurst({ className, style }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <path
        d="M50 0 L58 35 L100 30 L65 50 L100 70 L58 65 L50 100 L42 65 L0 70 L35 50 L0 30 L42 35 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function B2B() {
  useSeo({
    title: 'B2B Presale — Avalon Vitality',
    description: 'Race-day IV, shots, and recovery for Bay to Breakers 2026. Pre-buy at the expo and hit the finish line dialed.',
    path: '/b2b',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Bay to Breakers — Avalon Vitality Recovery',
      startDate: '2026-05-17T09:00:00-07:00',
      endDate: '2026-05-17T14:00:00-07:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: 'Finish line · Ocean Beach',
        address: { '@type': 'PostalAddress', addressLocality: 'San Francisco', addressRegion: 'CA', addressCountry: 'US' },
      },
      image: ['https://avalonvitality.co/og-b2b.png'],
      description: 'Race-day IV, shots, and recovery for Bay to Breakers 2026.',
      offers: {
        '@type': 'Offer',
        url: 'https://avalonvitality.co/b2b',
        price: '150.00',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        validFrom: '2026-04-29T00:00:00-07:00',
      },
      organizer: { '@type': 'Organization', name: 'Avalon Vitality', url: 'https://avalonvitality.co' },
    },
  });

  // ---- state ----
  const [productId, setProductId] = useState(B2B_PRODUCTS[0].id);
  const [compression, setCompression] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftRecipientEmail, setGiftRecipientEmail] = useState('');

  // ---- derived ----
  const product = useMemo(
    () => B2B_PRODUCTS.find((p) => p.id === productId),
    [productId]
  );
  const b2bIvRemaining = Math.max(0, B2B_IV_INVENTORY - B2B_IV_SOLD);
  const b2bIvSoldOut = b2bIvRemaining <= 0;
  const imShotRemaining = Math.max(0, IM_SHOT_INVENTORY - IM_SHOT_SOLD);
  const imShotSoldOut = imShotRemaining <= 0;
  const selectedSoldOut = !!(product?.consumes?.includes('b2bIv') && b2bIvSoldOut);
  const productIncludesBoots = !!product?.consumes?.includes('boots');

  // ---- effects ----
  // Fire PageView for retargeting on /b2b mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (typeof window.fbq === 'function') window.fbq('track', 'PageView');
      if (typeof window.gtag === 'function') window.gtag('event', 'page_view', { page_path: '/b2b', page_title: 'B2B Presale' });
    } catch (e) {}
  }, []);

  // Sticky mobile buy bar — only after hero scroll
  useEffect(() => {
    const handler = () => setShowStickyCta(window.scrollY > 280);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  // Force-uncheck compression when current selection already includes boots
  useEffect(() => {
    if (productIncludesBoots && compression) {
      setCompression(false);
    }
  }, [productIncludesBoots, compression]);

  const subtotal = product.price + (compression ? COMPRESSION_ADDON.price : 0);
  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const c = COUPONS[appliedCoupon];
    if (!c) return 0;
    if (c.kind === 'percent') return Math.round(subtotal * (c.value / 100));
    return Math.min(c.value, subtotal);
  }, [appliedCoupon, subtotal]);
  const total = Math.max(0, subtotal - discount);

  const handleCoupon = (e) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (!COUPONS[code]) {
      setCouponError('Invalid code');
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(code);
    setCouponError('');
  };

  const clearCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError('');
  };

  // Tracking pixels — fires on Pay-with-Square click. No-op if pixels not loaded.
  const fireCheckoutEvent = () => {
    try {
      if (typeof window === 'undefined') return;
      const payload = {
        currency: 'USD',
        value: total,
        items: [{ id: product.id, name: product.name, price: product.price }],
        coupon: appliedCoupon || undefined,
      };
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'InitiateCheckout', payload);
      }
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'begin_checkout', payload);
      }
    } catch (e) {
      // swallow tracking errors — never block checkout
    }
  };

    // For Square Payment Links: open the link for the selected base item.
  // Compression + coupon are noted in the URL params (Square's page reads memo).
  const checkoutUrl = useMemo(() => {
    const url = new URL(product.squareUrl);
    const memo = [];
    if (compression) memo.push('+ Normatec compression boots ($50)');
    if (appliedCoupon) memo.push(`Coupon ${appliedCoupon} (${COUPONS[appliedCoupon].label})`);
    if (isGift) memo.push(`Gift for ${giftRecipientName || '(name not provided)'} <${giftRecipientEmail || 'email not provided'}>`);
    memo.push(`Total: $${total}`);
    if (memo.length) url.searchParams.set('memo', memo.join(' · '));
    return url.toString();
  }, [product.squareUrl, compression, appliedCoupon, total, isGift, giftRecipientName, giftRecipientEmail]);

  return (
    <div className="b2b-root min-h-screen flex flex-col relative">
      {/* Scattered B2B starbursts — decorative, behind content */}
      <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <StarBurst className="absolute b2b-pink"  style={{ top: '4%',   left: '6%',  width: '34px', height: '34px', transform: 'rotate(-14deg)', opacity: 0.85 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '7%',   right: '8%', width: '46px', height: '46px', transform: 'rotate(18deg)',  opacity: 0.95 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '13%',  left: '38%', width: '22px', height: '22px', transform: 'rotate(-6deg)',  opacity: 0.55 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '19%',  left: '2%',  width: '28px', height: '28px', transform: 'rotate(22deg)',  opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '24%',  right: '4%', width: '52px', height: '52px', transform: 'rotate(-22deg)', opacity: 0.75 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '31%',  left: '46%', width: '24px', height: '24px', transform: 'rotate(8deg)',   opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '37%',  left: '4%',  width: '38px', height: '38px', transform: 'rotate(-18deg)', opacity: 0.8  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '43%',  right: '6%', width: '30px', height: '30px', transform: 'rotate(12deg)',  opacity: 0.65 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '50%',  left: '20%', width: '44px', height: '44px', transform: 'rotate(-10deg)', opacity: 0.85 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '56%',  right: '18%',width: '26px', height: '26px', transform: 'rotate(20deg)',  opacity: 0.6  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '62%',  left: '8%',  width: '36px', height: '36px', transform: 'rotate(-24deg)', opacity: 0.75 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '68%',  right: '3%', width: '40px', height: '40px', transform: 'rotate(14deg)',  opacity: 0.8  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '74%',  left: '42%', width: '22px', height: '22px', transform: 'rotate(-4deg)',  opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '80%',  left: '6%',  width: '32px', height: '32px', transform: 'rotate(16deg)',  opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '85%',  right: '10%',width: '48px', height: '48px', transform: 'rotate(-16deg)', opacity: 0.85 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '91%',  left: '30%', width: '26px', height: '26px', transform: 'rotate(10deg)',  opacity: 0.6  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '95%',  right: '24%',width: '30px', height: '30px', transform: 'rotate(-20deg)', opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '98%',  left: '12%', width: '20px', height: '20px', transform: 'rotate(6deg)',   opacity: 0.55 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '2%',   left: '24%', width: '24px', height: '24px', transform: 'rotate(11deg)',  opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '6%',   left: '60%', width: '30px', height: '30px', transform: 'rotate(-19deg)', opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '11%',  right: '32%',width: '20px', height: '20px', transform: 'rotate(7deg)',   opacity: 0.45 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '16%',  right: '14%',width: '36px', height: '36px', transform: 'rotate(-9deg)',  opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '21%',  left: '52%', width: '28px', height: '28px', transform: 'rotate(15deg)',  opacity: 0.65 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '27%',  left: '14%', width: '20px', height: '20px', transform: 'rotate(-2deg)',  opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '33%',  right: '22%',width: '34px', height: '34px', transform: 'rotate(13deg)',  opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '40%',  left: '64%', width: '28px', height: '28px', transform: 'rotate(-11deg)', opacity: 0.6  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '46%',  left: '2%',  width: '22px', height: '22px', transform: 'rotate(19deg)',  opacity: 0.55 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '53%',  right: '36%',width: '24px', height: '24px', transform: 'rotate(-7deg)',  opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '59%',  left: '58%', width: '30px', height: '30px', transform: 'rotate(21deg)',  opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '65%',  left: '28%', width: '20px', height: '20px', transform: 'rotate(-15deg)', opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '71%',  right: '12%',width: '32px', height: '32px', transform: 'rotate(9deg)',   opacity: 0.65 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '77%',  right: '40%',width: '24px', height: '24px', transform: 'rotate(-23deg)', opacity: 0.55 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '83%',  left: '54%', width: '36px', height: '36px', transform: 'rotate(17deg)',  opacity: 0.7  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '88%',  right: '32%',width: '22px', height: '22px', transform: 'rotate(-5deg)',  opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '93%',  left: '62%', width: '28px', height: '28px', transform: 'rotate(13deg)',  opacity: 0.6  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '15%',  left: '18%', width: '18px', height: '18px', transform: 'rotate(3deg)',   opacity: 0.45 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '35%',  left: '32%', width: '22px', height: '22px', transform: 'rotate(-13deg)', opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '52%',  left: '88%', width: '20px', height: '20px', transform: 'rotate(7deg)',   opacity: 0.55 }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '70%',  left: '52%', width: '20px', height: '20px', transform: 'rotate(-3deg)',  opacity: 0.5  }} />
        <StarBurst className="absolute b2b-pink"  style={{ top: '86%',  left: '36%', width: '24px', height: '24px', transform: 'rotate(11deg)',  opacity: 0.55 }} />
      </div>
      <style>{`
        .b2b-root {
          background-color: #FFFEE4;
          color: #0A0A0A;
          scroll-behavior: smooth;
        }
        @media (prefers-reduced-motion: reduce) {
          .b2b-root, .b2b-root * { scroll-behavior: auto !important; animation: none !important; transition: none !important; }
          .b2b-card.active { transform: none !important; }
        }
        @media (max-width: 767px) { .b2b-root { padding-bottom: 80px; } }
        .b2b-display {
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          letter-spacing: 0.02em;
          font-weight: 400;
        }
        .b2b-pink { color: #ED7AC3; }
        .b2b-bg-pink { background-color: #ED7AC3; }
        .b2b-sticky-buy {
          background-color: rgba(237, 122, 195, 0.95);
          color: #0A0A0A;
          border: 2px solid #0A0A0A;
          box-shadow: 4px 4px 0 #0A0A0A;
          backdrop-filter: saturate(140%) blur(6px);
          -webkit-backdrop-filter: saturate(140%) blur(6px);
        }
        .b2b-sticky-buy:active {
          transform: translate(2px, 2px);
          box-shadow: 2px 2px 0 #0A0A0A;
        }
        .b2b-mint { background-color: #80C7D3; }
        .b2b-soft-yellow { background-color: #F8EC82; }
        .b2b-card {
          background-color: #ffffff;
          border: 2px solid #0A0A0A;
          border-radius: 1.25rem;
          box-shadow: 6px 6px 0 0 #0A0A0A;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .b2b-card:hover {
          transform: translate(-1px, -1px);
          box-shadow: 7px 7px 0 0 #0A0A0A;
        }
        .b2b-card.active {
          background-color: #FFE9F2;
          border-color: #ED7AC3;
          border-width: 3px;
          box-shadow: 6px 6px 0 0 #ED7AC3;
          transform: translate(-2px, -2px);
        }
        .b2b-card.active::before {
          content: '\u2713';
          position: absolute;
          top: 8px;
          right: 12px;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background-color: #ED7AC3;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
          z-index: 1;
        }
        .b2b-btn-primary {
          background-color: #ED7AC3;
          color: #0A0A0A;
          border: 2px solid #0A0A0A;
          border-radius: 999px;
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          letter-spacing: 0.15em;
          padding: 1rem 2rem;
          font-size: 1.1rem;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 4px 4px 0 0 #0A0A0A;
        }
        .b2b-btn-primary:hover {
          background-color: #d96aae;
          transform: translate(-1px, -1px);
          box-shadow: 5px 5px 0 0 #0A0A0A;
        }
        .b2b-btn-secondary {
          background-color: #9DD9D2;
          color: #0A0A0A;
          border: 2px solid #0A0A0A;
          border-radius: 999px;
          padding: 0.6rem 1.4rem;
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          letter-spacing: 0.18em;
          font-size: 0.85rem;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .b2b-btn-secondary:hover { transform: translate(-1px, -1px); }
        .b2b-input {
          background-color: #ffffff;
          border: 2px solid #0A0A0A;
          border-radius: 999px;
          padding: 0.75rem 1.25rem;
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          letter-spacing: 0.18em;
          font-size: 0.95rem;
          color: #0A0A0A;
        }
        .b2b-input:focus { outline: 2px solid #ED7AC3; outline-offset: 2px; }
      `}</style>


      {/* Hero */}
      <section className="relative z-10 relative px-5 md:px-10 pt-4 md:pt-8 pb-4 md:pb-8 overflow-hidden">
        {/* Star accents */}
        <StarBurst className="absolute top-8 left-6 w-6 h-6 b2b-pink rotate-12" />
        <StarBurst className="absolute top-20 right-8 w-8 h-8 b2b-pink -rotate-12" />


        <div className="relative max-w-4xl mx-auto text-center">
          <p className="b2b-display b2b-pink text-3xl md:text-6xl mb-1 md:mb-3 tracking-widest text-center mx-auto leading-none">Avalon Vitality &times;</p>
          <p className="b2b-display text-[10px] md:text-xs tracking-[0.3em] uppercase b2b-pink text-center mb-3 md:mb-4">
            Official Bay to Breakers Recovery Partner
          </p>
          {/* Official Bay to Breakers wordmark — drop file at /public/bay-to-breakers-logo.png (or .svg) */}
          <h1 className="m-0">
            <picture>
              <source srcSet="/bay-to-breakers-logo.webp" type="image/webp" />
              <img
                src="/bay-to-breakers-logo.png"
                alt="Bay to Breakers"
                width="1164"
                height="531"
                fetchpriority="high"
                decoding="async"
                className="block mx-auto w-[40vw] max-w-[200px] md:max-w-[300px] h-auto"
              />
            </picture>
          </h1>
          <p className="mt-3 md:mt-5 b2b-display text-3xl md:text-5xl tracking-[0.14em] md:tracking-[0.18em] uppercase text-center leading-[0.95]">
            Sunday &middot; May 17
            <br />
            9 AM &ndash; 2 PM
          </p>
          <p className="mt-2 md:mt-3 b2b-display text-sm md:text-xl tracking-[0.22em] uppercase text-center text-black/70 leading-tight">
            Finish line &middot; Ocean Beach
          </p>
          <p className="mt-3 md:mt-5 text-base md:text-2xl b2b-display tracking-wide text-center leading-tight inline-flex items-center gap-2 flex-wrap justify-center w-full">
            <span>Finish-line IV, shots, &amp; recovery.</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 md:w-6 md:h-6 b2b-pink inline-block"
            >
              <path d="M12 21s-7.5-4.5-9.6-9.5C.9 7.6 3.5 4 7 4c2 0 3.7 1 5 2.5C13.3 5 15 4 17 4c3.5 0 6.1 3.6 4.6 7.5C19.5 16.5 12 21 12 21z" />
            </svg>
          </p>
        </div>
      </section>

      {/* How it works — 3 steps */}
      <section className="relative z-10 px-5 md:px-10 pb-6 md:pb-10 pt-2 md:pt-4">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-lg md:text-2xl mb-3 md:mb-5 uppercase tracking-wide">How it works</p>
          <div className="grid grid-cols-3 gap-3 md:gap-5">
            {[
              { n: '01', t: 'Pre-buy', d: 'Lock your slot now. Confirmation email + race-morning text from Avalon.' },
              { n: '02', t: 'Run your race', d: 'Cross the line. Walk to the Avalon recovery zone (location texted that morning).' },
              { n: '03', t: 'Recover', d: 'Sit down, hydrate, IV / shot / boots, walk out feeling human.' },
            ].map((s) => (
              <div key={s.n} className="b2b-card p-3 md:p-5">
                <p className="b2b-display text-2xl md:text-4xl b2b-pink leading-none mb-1 md:mb-2">{s.n}</p>
                <p className="b2b-display text-base md:text-2xl uppercase mb-1 md:mb-2 leading-tight">{s.t}</p>
                <p className="text-xs md:text-sm leading-snug">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Singles */}
      <section className="relative z-10 px-5 md:px-10 pt-2 pb-8 md:pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-lg md:text-2xl mb-3 md:mb-5 uppercase tracking-wide">Pick your tier &darr;</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {B2B_PRODUCTS.filter((p) => p.kind === 'single').map((p) => {
              const showIvCount = p.consumes?.includes('b2bIv');
              const ivCardSoldOut = showIvCount && b2bIvSoldOut;
              const showImCount = !showIvCount && p.consumes?.includes('imShot');
              const imCardSoldOut = showImCount && imShotSoldOut;
              const cardSoldOut = ivCardSoldOut || imCardSoldOut;
              const active = p.id === productId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => !ivCardSoldOut && setProductId(p.id)}
                  disabled={ivCardSoldOut}
                  className={`b2b-card text-left p-4 md:p-6 flex flex-col h-full md:min-h-[240px] relative ${active ? 'active' : ''} ${cardSoldOut ? 'opacity-50 cursor-not-allowed' : ''}`}
                  aria-pressed={active}
                >
                  <p className="b2b-display text-xs md:text-xs tracking-[0.2em] uppercase b2b-pink mb-2 md:mb-2">{p.tagline}</p>
                  <h3 className="b2b-display text-2xl md:text-3xl uppercase mb-2 md:mb-3 leading-tight">{p.name}</h3>
                  <p className="text-sm md:text-sm leading-snug mb-3 md:mb-4 flex-1">{p.description}</p>
                  {showIvCount && (
                    <p className="b2b-display text-[10px] md:text-xs tracking-[0.2em] uppercase b2b-pink mb-1.5 md:mb-2">
                      {ivCardSoldOut ? 'Sold out' : `${b2bIvRemaining} / ${B2B_IV_INVENTORY} left`}
                    </p>
                  )}
                  <p className="b2b-display text-4xl md:text-5xl mt-auto leading-none">${p.price}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Compression add-on — hidden when selected SKU already includes boots */}
      {!productIncludesBoots && (
        <section className="relative z-10 px-5 md:px-10 pb-10 md:pb-14">
          <div className="max-w-5xl mx-auto">
            <button
              type="button"
              onClick={() => setCompression((v) => !v)}
              className={`w-full text-left b2b-card p-5 md:p-6 flex items-center gap-5 ${compression ? 'active' : ''}`}
              aria-pressed={compression}
            >
              <div className={`w-10 h-10 rounded-full border-2 border-black flex items-center justify-center shrink-0 ${compression ? 'b2b-bg-pink text-white' : 'bg-white'}`}>
                {compression ? <Plus className="w-5 h-5 rotate-45" /> : <Plus className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <p className="b2b-display text-xs tracking-[0.25em] uppercase b2b-pink mb-1">+$50 add-on</p>
                <h3 className="b2b-display text-2xl md:text-3xl uppercase leading-tight">{COMPRESSION_ADDON.name}</h3>
                <p className="text-sm md:text-base mt-1">{COMPRESSION_ADDON.description}</p>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* Bundles */}
      <section className="relative z-10 px-5 md:px-10 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-[10px] md:text-xs tracking-[0.3em] uppercase b2b-pink mb-2">{B2B_IV_INVENTORY - b2bIvRemaining} of {B2B_IV_INVENTORY} B2B IV spots claimed</p>
          <p className="b2b-display text-2xl md:text-3xl mb-2 md:mb-3 uppercase tracking-wide">Or save with a package</p>
          <p className="text-sm md:text-base mb-5 md:mb-7">Pre-bundled combos. Boots already included where listed.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {B2B_PRODUCTS.filter((p) => p.kind === 'bundle').map((p) => {
              const active = p.id === productId;
              const savings = p.originalPrice ? p.originalPrice - p.price : 0;
              const showIvCount = p.consumes?.includes('b2bIv');
              const ivCardSoldOut = showIvCount && b2bIvSoldOut;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => !ivCardSoldOut && setProductId(p.id)}
                  disabled={ivCardSoldOut}
                  className={`b2b-card text-left p-4 md:p-6 flex flex-col h-full md:min-h-[300px] ${active ? 'active' : ''} ${ivCardSoldOut ? 'opacity-50 cursor-not-allowed' : ''} relative`}
                  aria-pressed={active}
                >
                  {savings > 0 && !ivCardSoldOut && !active && (
                    <span className="b2b-display absolute top-2 md:top-4 right-2 md:right-4 b2b-bg-pink text-white text-[10px] md:text-xs tracking-[0.15em] uppercase px-2 py-0.5 md:px-3 md:py-1 rounded-full">
                      Save ${savings}
                    </span>
                  )}
                  {ivCardSoldOut && (
                    <span className="b2b-display absolute top-2 md:top-4 right-2 md:right-4 bg-black text-white text-[10px] md:text-xs tracking-[0.15em] uppercase px-2 py-0.5 md:px-3 md:py-1 rounded-full">
                      Sold out
                    </span>
                  )}
                  <p className="b2b-display text-xs md:text-xs tracking-[0.2em] uppercase b2b-pink mb-2 md:mb-2">{p.tagline}</p>
                  <h3 className="b2b-display text-2xl md:text-3xl uppercase mb-2 md:mb-3 leading-tight pr-14 md:pr-20">{p.name}</h3>
                  <p className="text-sm md:text-base leading-snug mb-3 md:mb-4 flex-1">{p.description}</p>
                  {showIvCount && (
                    <p className="b2b-display text-xs md:text-xs tracking-[0.2em] uppercase b2b-pink mb-2">
                      {ivCardSoldOut ? 'Sold out' : `${b2bIvRemaining} / ${B2B_IV_INVENTORY} left`}
                    </p>
                  )}
                  {showImCount && (
                    <p className="b2b-display text-xs md:text-xs tracking-[0.2em] uppercase b2b-pink mb-2">
                      {imCardSoldOut ? 'Sold out' : `${imShotRemaining} / ${IM_SHOT_INVENTORY} left`}
                    </p>
                  )}
                  <div className="flex items-baseline gap-2 md:gap-3 mt-auto">
                    <p className="b2b-display text-4xl md:text-5xl leading-none">${p.price}</p>
                    {p.originalPrice && (
                      <p className="b2b-display text-base md:text-2xl line-through opacity-60">${p.originalPrice}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Team rates contact card — full-width below bundle grid */}
          <a
            href="mailto:rob@avalonvitality.co?subject=Bay%20to%20Breakers%20team%20rate&body=Hi%20Rob%2C%0A%0AWe%27re%20a%20team%20of%20%5B%5D%20heading%20to%20Bay%20to%20Breakers.%20Curious%20about%20group%20rates%20for%20IV%20%2B%20shots%20%2B%20boots%20at%20the%20finish%20line.%0A%0AThanks%21"
            className="b2b-card mt-5 md:mt-6 p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-5 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
            style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <div className="flex-1">
              <p className="b2b-display text-[10px] md:text-xs tracking-[0.3em] uppercase b2b-pink mb-1.5 md:mb-2">Team rates</p>
              <h3 className="b2b-display text-xl md:text-3xl uppercase mb-1 md:mb-2 leading-tight">Got a team? Contact us for special rates.</h3>
              <p className="text-sm md:text-base">Centipede crews, corporate teams, sponsors. Email Rob and we&rsquo;ll build you a finish-line package.</p>
            </div>
            <span className="b2b-display text-sm md:text-base tracking-[0.2em] uppercase b2b-pink inline-flex items-center gap-2 shrink-0">
              rob@avalonvitality.co
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
            </span>
          </a>
        </div>
      </section>

      {/* Coupon */}
      <section className="relative z-10 px-5 md:px-10 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-xl md:text-2xl mb-4 uppercase tracking-wide">Got a code?</p>
          {appliedCoupon ? (
            <div className="b2b-card p-4 md:p-5 flex items-center gap-4">
              <Tag className="w-5 h-5 b2b-pink" />
              <div className="flex-1">
                <p className="b2b-display text-lg uppercase">{appliedCoupon} applied</p>
                <p className="text-sm">{COUPONS[appliedCoupon].label} &mdash; ${discount} off at the finish line. Show your confirmation email to redeem.</p>
              </div>
              <button
                type="button"
                onClick={clearCoupon}
                className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                aria-label="Remove coupon"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleCoupon} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                className="b2b-input flex-1"
                aria-label="Coupon code"
              />
              <button type="submit" className="b2b-btn-secondary">
                Apply
              </button>
            </form>
          )}
          {couponError && <p className="mt-2 text-sm b2b-pink">{couponError}</p>}
        </div>
      </section>

      {/* Your visit — what to expect on race day */}
      <section className="relative z-10 px-5 md:px-10 pb-8 md:pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-lg md:text-2xl mb-3 md:mb-5 uppercase tracking-wide">Your visit</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
            {[
              { t: 'Time on chair', d: 'IM shot 5–10 min. IV 20–30 min. Normatec compression boots 20 min.' },
              { t: 'Setup', d: 'Sit upright in a recovery chair. Shade, water, towels on hand. Privacy curtain available.' },
              { t: 'Walk out', d: 'No queueing for a follow-up. You leave the moment your bag empties or your timer hits 20.' },
            ].map((v) => (
              <div key={v.t} className="b2b-card p-3 md:p-5">
                <p className="b2b-display text-base md:text-xl uppercase mb-1 leading-tight">{v.t}</p>
                <p className="text-sm md:text-base leading-snug">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — pulled from the main site, event-relevant picks */}
      <section className="relative z-10 px-5 md:px-10 pb-8 md:pb-12">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-lg md:text-2xl mb-3 md:mb-5 uppercase tracking-wide">Real Avalon recoveries</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
            {[
              {
                quote: 'Booked Avalon for a festival. Green room was lit. They set up an entire recovery lounge backstage. Artists and crew loved it.',
                name: 'G.B.', tag: 'Event recovery',
              },
              {
                quote: 'That IV did digits.',
                name: 'Larry June', tag: 'Recovery IV',
              },
            ].map((t) => (
              <figure key={t.name} className="b2b-card p-4 md:p-5">
                <blockquote className="text-sm md:text-base leading-relaxed mb-3">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="b2b-display text-xs md:text-sm tracking-[0.2em] uppercase b2b-pink">
                  &mdash; {t.name} &middot; {t.tag}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

            {/* Order summary + checkout */}
      <section id="b2b-checkout" className="relative z-10 px-5 md:px-10 pb-14 md:pb-20 scroll-mt-20">
        <div className="max-w-3xl mx-auto b2b-card p-6 md:p-8">
          <p className="b2b-display text-xl md:text-2xl uppercase tracking-wide mb-5">Your race day</p>

          <div className="space-y-3 mb-5">
            <div className="flex justify-between gap-4">
              <span className="text-sm md:text-base">{product.name}</span>
              <span className="b2b-display text-lg md:text-xl">${product.price}</span>
            </div>
            {compression && (
              <div className="flex justify-between gap-4">
                <span className="text-sm md:text-base">+ {COMPRESSION_ADDON.name}</span>
                <span className="b2b-display text-lg md:text-xl">${COMPRESSION_ADDON.price}</span>
              </div>
            )}
            {appliedCoupon && (
              <div className="flex justify-between gap-4 b2b-pink">
                <span className="text-sm md:text-base">Coupon {appliedCoupon}</span>
                <span className="b2b-display text-lg md:text-xl">&minus;${discount}</span>
              </div>
            )}
          </div>

          {/* Gift toggle */}
          <div className="border-t-2 border-black pt-4 mb-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isGift}
                onChange={(e) => setIsGift(e.target.checked)}
                className="mt-1 w-4 h-4 accent-[#ED7AC3]"
              />
              <span className="text-sm md:text-base leading-snug">
                <span className="b2b-display uppercase tracking-wide">This is a gift for a runner</span>
                <span className="block text-xs md:text-sm text-black/70 mt-0.5">We&rsquo;ll send the confirmation to them. Pickup-name will be the recipient.</span>
              </span>
            </label>
            {isGift && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Recipient name"
                  value={giftRecipientName}
                  onChange={(e) => setGiftRecipientName(e.target.value)}
                  className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#ED7AC3]"
                />
                <input
                  type="email"
                  placeholder="Recipient email"
                  value={giftRecipientEmail}
                  onChange={(e) => setGiftRecipientEmail(e.target.value)}
                  className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm md:text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#ED7AC3]"
                />
              </div>
            )}
          </div>

          <div className="flex justify-between items-baseline border-t-2 border-black pt-4 mb-3">
            <span className="b2b-display text-2xl md:text-3xl uppercase">Total</span>
            <span className="b2b-display text-4xl md:text-5xl">${total}</span>
          </div>
          <p className="b2b-display text-[10px] md:text-xs tracking-[0.2em] uppercase b2b-pink mb-4 md:mb-5">
            Full refund before May 14
          </p>

          {selectedSoldOut ? (
            <button
              type="button"
              disabled
              className="b2b-btn-primary w-full inline-flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
            >
              Sold out — pick another option
            </button>
          ) : (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={fireCheckoutEvent}
              className="b2b-btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              Pay with Square <ArrowRight className="w-4 h-4" />
            </a>
          )}

          <p className="mt-4 text-xs leading-relaxed text-black/70">
            Payment processed securely by Square. Confirmation email sent immediately. Race-morning text from Avalon with the location.
          </p>
        </div>
      </section>

            {/* FAQ */}
      <section className="relative z-10 px-5 md:px-10 pb-12 md:pb-16">
        <div className="max-w-3xl mx-auto">
          <p className="b2b-display text-2xl md:text-3xl mb-5 md:mb-7 uppercase tracking-wide">Race-day questions</p>
          <div className="space-y-3">
            {[
              {
                q: 'Where will Avalon be?',
                a: 'At the finish line with limited space. A second site is TBD and will be announced soon. Location texted to your phone the morning of the race.',
              },
              {
                q: 'Do I need to schedule a time?',
                a: 'No. First come, first served once you cross. Slots typically clear in 20–30 minutes during peak.',
              },
              {
                q: 'Can I bring a friend?',
                a: 'Of course. Friends without a ticket can hang out — service requires a ticket. Group bundles available, email support@avalonvitality.co.',
              },
              {
                q: 'What if I can\'t make it?',
                a: 'Email support@avalonvitality.co before May 14 for a full refund.',
              },
              {
                q: 'Is this medical care?',
                a: 'No. Avalon delivers IV hydration and intramuscular injections under standing-order medical direction for educational and wellness use. Not for the diagnosis or treatment of any condition.',
              },
            ].map((item) => (
              <details key={item.q} className="b2b-card p-4 md:p-5 group">
                <summary className="b2b-display text-base md:text-lg uppercase tracking-wide cursor-pointer flex items-center justify-between gap-4 list-none">
                  <span>{item.q}</span>
                  <Plus className="w-4 h-4 shrink-0 transition-transform group-open:rotate-45" />
                </summary>
                <p className="text-sm md:text-base mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

{/* Confetti accent strip — small geometric shapes scattered before footer */}
      <div className="relative h-12 md:h-16 overflow-hidden">
        <svg className="absolute left-[5%] top-1 w-8 h-8 b2b-pink fill-current" viewBox="0 0 20 20"><polygon points="0,0 20,0 14,18" /></svg>
        <svg className="absolute left-[20%] top-3 w-6 h-6 fill-current" style={{color:'#F8EC82'}} viewBox="0 0 20 20"><rect width="20" height="20" /></svg>
        <svg className="absolute left-[35%] top-5 w-7 h-7 fill-current" style={{color:'#FF6347'}} viewBox="0 0 20 20"><polygon points="10,0 20,10 10,20 0,10" /></svg>
        <svg className="absolute left-[55%] top-2 w-8 h-8 b2b-pink fill-current" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" /></svg>
        <svg className="absolute left-[72%] top-4 w-6 h-6 fill-current" style={{color:'#80C7D3'}} viewBox="0 0 20 20"><polygon points="0,0 20,0 14,18" /></svg>
        <svg className="absolute left-[88%] top-1 w-7 h-7 fill-current" style={{color:'#F8EC82'}} viewBox="0 0 20 20"><rect width="20" height="20" transform="rotate(15 10 10)" /></svg>
      </div>

      {/* Footer / disclaimer */}
      <footer className="relative z-10 px-5 md:px-10 py-6 md:py-8 border-t-2 border-black mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.2em]">
            <p>Avalon Vitality &middot; California-licensed clinicians</p>
            <p className="normal-case tracking-normal text-black/70 mt-1">San Francisco's mobile IV therapy + longevity platform. RN-administered, physician-supervised.</p>
          </div>
          <p className="text-xs uppercase tracking-[0.2em]">
            <Link to="/" className="hover:b2b-pink transition-colors">Back to avalonvitality.co</Link>
          </p>
        </div>
        <p className="max-w-3xl mx-auto mt-4 text-[11px] leading-relaxed text-black/60 text-center">
          Avalon Vitality is the official Bay to Breakers Recovery Partner for 2026. Statements made by Avalon Vitality have not been evaluated by the U.S. Food and Drug Administration. Services not intended to diagnose, treat, cure, or prevent any disease. Individual results vary. Consult your physician before any therapy. Need accessibility accommodations? Email support@avalonvitality.co before May 14 and we&rsquo;ll arrange them.
        </p>
      </footer>
      {/* Sticky mobile CTA — appears after hero scroll, hidden on desktop */}
      <div
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2 pointer-events-none transition-all duration-300 ${
          showStickyCta ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        aria-hidden={!showStickyCta}
      >
        <a
          href="#b2b-checkout"
          className="b2b-sticky-buy pointer-events-auto flex items-center justify-between gap-3 px-5 py-3 rounded-full shadow-lg"
        >
          <span className="b2b-display text-sm uppercase tracking-[0.15em] truncate">{product.name}</span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="b2b-display text-lg">${total}</span>
            <ArrowRight className="w-4 h-4" />
          </span>
        </a>
      </div>
    </div>
  );
}
