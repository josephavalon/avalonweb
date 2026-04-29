import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Tag, X as XIcon, Plus } from 'lucide-react';
import { B2B_PRODUCTS, COMPRESSION_ADDON, COUPONS } from '@/data/b2bProducts';
import { useSeo } from '@/lib/seo';

// Visual reference: baytobreakers.com (cream bg, distressed black display, pink stars,
// mint accent). Original layout. Avalon brand crossed in via the teardrop + voice.

function StarBurst({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
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
  });

  const [productId, setProductId] = useState(B2B_PRODUCTS[0].id);
  const [compression, setCompression] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  const product = useMemo(
    () => B2B_PRODUCTS.find((p) => p.id === productId),
    [productId]
  );
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

  // For Square Payment Links: open the link for the selected base item.
  // Compression + coupon are noted in the URL params (Square's page reads memo).
  const checkoutUrl = useMemo(() => {
    const url = new URL(product.squareUrl);
    const memo = [];
    if (compression) memo.push('+ Compression boots ($50)');
    if (appliedCoupon) memo.push(`Coupon ${appliedCoupon} (${COUPONS[appliedCoupon].label})`);
    memo.push(`Total: $${total}`);
    if (memo.length) url.searchParams.set('memo', memo.join(' · '));
    return url.toString();
  }, [product.squareUrl, compression, appliedCoupon, total]);

  return (
    <div className="b2b-root min-h-screen flex flex-col">
      <style>{`
        .b2b-root {
          background-color: #FFFEE4;
          color: #0A0A0A;
        }
        .b2b-display {
          font-family: 'Bebas Neue', 'Impact', sans-serif;
          letter-spacing: 0.02em;
          font-weight: 400;
        }
        .b2b-pink { color: #ED7AC3; }
        .b2b-bg-pink { background-color: #ED7AC3; }
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
          box-shadow: 6px 6px 0 0 #ED7AC3;
        }
        .b2b-btn-primary {
          background-color: #80C7D3;
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
          background-color: #ED7AC3;
          color: #ffffff;
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

      {/* Top bar — back to avalon, brand crossover */}
      <header className="px-5 md:px-10 py-5 md:py-6 flex items-center justify-between border-b-2 border-black">
        <Link to="/" className="inline-flex items-center gap-2 text-black hover:text-[#ED7AC3] transition-colors text-sm tracking-[0.2em] uppercase">
          <ArrowLeft className="w-4 h-4" />
          Avalon
        </Link>
        <span className="text-sm tracking-[0.25em] uppercase">May 15&ndash;18, 2026</span>
      </header>

      {/* Hero */}
      <section className="relative px-5 md:px-10 pt-8 md:pt-10 pb-8 md:pb-10 overflow-hidden">
        {/* Star accents */}
        <StarBurst className="absolute top-8 left-6 w-6 h-6 b2b-pink rotate-12" />
        <StarBurst className="absolute top-20 right-8 w-8 h-8 b2b-pink -rotate-12" />


        <div className="relative max-w-4xl mx-auto text-center">
          <p className="b2b-display b2b-pink text-2xl md:text-4xl mb-4 md:mb-6 tracking-widest text-center">Avalon Vitality &times;</p>
          {/* Official Bay to Breakers wordmark — drop file at /public/bay-to-breakers-logo.png (or .svg) */}
          <h1 className="m-0">
            <img
              src="/bay-to-breakers-logo.png"
              alt="Bay to Breakers"
              className="block mx-auto w-[55vw] max-w-[260px] md:max-w-[340px] h-auto"
            />
          </h1>
          <p className="mt-5 md:mt-7 text-sm md:text-lg b2b-display tracking-wide text-center">
            Finish-line IV, shots, &amp; recovery.<br />
            <span className="b2b-pink inline-flex items-center gap-2 flex-wrap justify-center">
              Pre-buy and we'll be there when you cross.
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 md:w-6 md:h-6 b2b-pink inline-block"
              >
                <path d="M12 21s-7.5-4.5-9.6-9.5C.9 7.6 3.5 4 7 4c2 0 3.7 1 5 2.5C13.3 5 15 4 17 4c3.5 0 6.1 3.6 4.6 7.5C19.5 16.5 12 21 12 21z" />
              </svg>
            </span>
          </p>
        </div>
      </section>

      {/* Singles */}
      <section className="px-5 md:px-10 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-2xl md:text-3xl mb-5 md:mb-7 uppercase tracking-wide">Pick your tier &darr;</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {B2B_PRODUCTS.filter((p) => p.kind === 'single').map((p) => {
              const active = p.id === productId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(p.id)}
                  className={`b2b-card text-left p-3 md:p-6 flex flex-col h-full min-h-[200px] md:min-h-[280px] ${active ? 'active' : ''}`}
                  aria-pressed={active}
                >
                  <p className="b2b-display text-[10px] md:text-xs tracking-[0.2em] uppercase b2b-pink mb-1.5 md:mb-2">{p.tagline}</p>
                  <h3 className="b2b-display text-lg md:text-3xl uppercase mb-2 md:mb-3 leading-tight">{p.name}</h3>
                  <p className="text-xs md:text-sm leading-snug mb-2 md:mb-4 flex-1">{p.description}</p>
                  <p className="b2b-display text-4xl md:text-5xl mt-auto leading-none">${p.price}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bundles */}
      <section className="px-5 md:px-10 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-2xl md:text-3xl mb-2 md:mb-3 uppercase tracking-wide">Or save with a package</p>
          <p className="text-sm md:text-base mb-5 md:mb-7">Pre-bundled combos. Pick one and skip the add-on toggle below.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {B2B_PRODUCTS.filter((p) => p.kind === 'bundle').map((p) => {
              const active = p.id === productId;
              const savings = p.originalPrice ? p.originalPrice - p.price : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(p.id)}
                  className={`b2b-card text-left p-3 md:p-6 ${active ? 'active' : ''} relative`}
                  aria-pressed={active}
                >
                  {savings > 0 && (
                    <span className="b2b-display absolute top-2 md:top-4 right-2 md:right-4 b2b-bg-pink text-white text-[10px] md:text-xs tracking-[0.15em] uppercase px-2 py-0.5 md:px-3 md:py-1 rounded-full">
                      Save ${savings}
                    </span>
                  )}
                  <p className="b2b-display text-[10px] md:text-xs tracking-[0.2em] uppercase b2b-pink mb-1.5 md:mb-2">{p.tagline}</p>
                  <h3 className="b2b-display text-base md:text-3xl uppercase mb-2 md:mb-3 leading-tight pr-14 md:pr-20">{p.name}</h3>
                  <p className="text-xs md:text-base leading-snug mb-2 md:mb-4">{p.description}</p>
                  <div className="flex items-baseline gap-2 md:gap-3">
                    <p className="b2b-display text-4xl md:text-5xl leading-none">${p.price}</p>
                    {p.originalPrice && (
                      <p className="b2b-display text-base md:text-2xl line-through opacity-60">${p.originalPrice}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Compression add-on */}
      <section className="px-5 md:px-10 pb-10 md:pb-14">
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

      {/* Coupon */}
      <section className="px-5 md:px-10 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <p className="b2b-display text-xl md:text-2xl mb-4 uppercase tracking-wide">Got a code?</p>
          {appliedCoupon ? (
            <div className="b2b-card p-4 md:p-5 flex items-center gap-4">
              <Tag className="w-5 h-5 b2b-pink" />
              <div className="flex-1">
                <p className="b2b-display text-lg uppercase">{appliedCoupon} applied</p>
                <p className="text-sm">{COUPONS[appliedCoupon].label} &mdash; saves ${discount}</p>
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

      {/* Order summary + checkout */}
      <section className="px-5 md:px-10 pb-14 md:pb-20">
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

          <div className="flex justify-between items-baseline border-t-2 border-black pt-4 mb-6">
            <span className="b2b-display text-2xl md:text-3xl uppercase">Total</span>
            <span className="b2b-display text-4xl md:text-5xl">${total}</span>
          </div>

          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="b2b-btn-primary w-full inline-flex items-center justify-center gap-2"
          >
            Pay with Square <ArrowRight className="w-4 h-4" />
          </a>

          <p className="mt-4 text-xs leading-relaxed text-black/70">
            Payment processed securely by Square. You will receive a confirmation email after purchase. Pickup details texted 48 hours before race weekend.
          </p>
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
      <footer className="px-5 md:px-10 py-6 md:py-8 border-t-2 border-black mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em]">Avalon Vitality &middot; California-licensed clinicians</p>
          <p className="text-xs uppercase tracking-[0.2em]">
            <Link to="/" className="hover:b2b-pink transition-colors">Back to avalonvitality.co</Link>
          </p>
        </div>
        <p className="max-w-3xl mx-auto mt-4 text-[11px] leading-relaxed text-black/60 text-center">
          Statements made by Avalon Vitality have not been evaluated by the U.S. Food and Drug Administration. Services not intended to diagnose, treat, cure, or prevent any disease. Individual results vary. Consult your physician before any therapy. Bay to Breakers is not affiliated with Avalon Vitality &mdash; this presale is independently operated.
        </p>
      </footer>
    </div>
  );
}
