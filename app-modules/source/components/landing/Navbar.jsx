import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Menu, MessageCircle, Phone, X } from 'lucide-react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { EASE, premiumTap } from '@/lib/motion';
import { cycleTheme } from '@/lib/theme';
import { useIsMobile } from '@/hooks/use-mobile';
import useNavHiddenOnScrollDown from '@/hooks/useNavHiddenOnScrollDown';
import { useAuthStore } from '@/lib/useAuthStore';
import PremiumButton from '@/components/ui/PremiumButton';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';
import AvalonMark from '@/components/AvalonMark';

const mainLinks = [
  { to: '/protocols', label: 'IV Therapy' },
  { to: '/subscription', label: 'Plans' },
  { to: '/launches', label: 'Launches' },
];

// Desktop hover-dropdown payload for "IV Therapy" — three categories with bag graphics.
const IV_TILES = [
  { title: 'IV Vitamins', desc: '8 hydration & wellness protocols', img: '/bags/energy.webp', href: '/protocols' },
  { title: 'IV CBD',      desc: '5 dosage tiers · 33–132 mg',       img: '/bags/cbd.webp',    href: '/services/cbd' },
  { title: 'IV NAD+',     desc: '7 dosage tiers · 250–1500 mg',     img: '/bags/nad.webp',    href: '/services/nad' },
];

function IVTherapyHover({ link, linkClassName }) {
  const [open, setOpen] = useState(false);
  // Inline styles for the reveal — no Tailwind JIT or motion library dependency.
  // onMouseEnter/Leave (universally supported) + onFocus/Blur for keyboard.
  const panelStyle = {
    position: 'absolute',
    left: '50%',
    top: '100%',
    zIndex: 50,
    width: '280px',
    // No paddingTop — wrapper's padding-bottom (16px) provides the visual gap
    // AND the hit area bridge so the cursor never leaves the wrapper.
    transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-4px)',
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none',
    transition: 'opacity 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
  };
  return (
    <div
      className="relative"
      // padding-bottom extends the hit area to cover the 14px gap between the link
      // and the panel's visual top; margin-bottom -16 cancels the padding for layout
      // so adjacent nav links don't shift. Without this, the cursor briefly leaves
      // the wrapper while crossing toward the panel and onMouseLeave slams it shut.
      style={{ paddingBottom: '16px', marginBottom: '-16px' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Link to={link.to} className={linkClassName} aria-haspopup="menu" aria-expanded={open}>
        <span className="relative z-10">{link.label}</span>
      </Link>
      <div
        role="menu"
        aria-label="IV Therapy categories"
        aria-hidden={!open}
        style={panelStyle}
      >
        <div className="av-glass-menu overflow-hidden rounded-3xl border shadow-[0_28px_60px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-0.5 p-2">
            {IV_TILES.map((tile) => (
              <Link
                key={tile.href}
                to={tile.href}
                role="menuitem"
                tabIndex={open ? 0 : -1}
                className="group flex min-h-[44px] items-center justify-between gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-foreground/5 focus:outline-none focus-visible:bg-foreground/5"
                onClick={() => setOpen(false)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[1px] text-left">
                  <span className="font-body text-[13px] font-semibold leading-tight text-foreground">{tile.title}</span>
                  <span className="font-body text-[10.5px] leading-snug text-foreground/55">{tile.desc}</span>
                </span>
                <span
                  className="flex h-[34px] w-[24px] shrink-0 items-center justify-center"
                  style={{ filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.45))' }}
                >
                  <img
                    src={tile.img}
                    alt=""
                    loading="lazy"
                    style={{ height: '100%', width: 'auto', objectFit: 'contain', transform: 'scale(0.96)', transition: 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const BOOK_URL = '/book';
const PHONE_DISPLAY = '(415) 980-7708';
const PHONE_URL = 'tel:+14159807708';
const TEXT_URL = 'sms:+14159807708';

const dashboardPathFor = (user) => {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'nurse') return '/provider/shift';
  return '/members/dashboard';
};

export default function Navbar({ showBack = false, compact = false, focusMode = false, globalShell = false }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const tapState = useRef({ count: 0, timer: null });
  const { user, signOut } = useAuthStore();
  const mobilePanelRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Mobile menu accessibility: Escape closes, focus trap stays inside the
  // panel while open, focus returns to the trigger on close, and body scroll
  // locks so the menu feels modal. Native dialog semantics would be cleaner
  // but the panel is a sibling animated element rather than a real <dialog>,
  // so we wire ARIA + key handling by hand.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previouslyFocused = typeof document !== 'undefined' ? document.activeElement : null;
    const body = typeof document !== 'undefined' ? document.body : null;
    const previousOverflow = body?.style.overflow || '';
    if (body) body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = mobilePanelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // Focus the first interactive element on open. Defer one frame so the
    // panel is fully mounted (SmoothDisclosure animates open).
    const focusTimer = window.setTimeout(() => {
      const panel = mobilePanelRef.current;
      const firstFocusable = panel?.querySelector(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
      if (body) body.style.overflow = previousOverflow;
      // Restore focus to the toggle button so screen reader users don't lose
      // their place.
      if (mobileMenuButtonRef.current) {
        mobileMenuButtonRef.current.focus();
      } else if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    // Prefetch the booking chunk during idle time so it never competes with the
    // initial critical path (FCP/LCP). Stripe.js is NOT pulled in by this — BookNow
    // imports `@stripe/stripe-js/pure`, which defers the Stripe script until checkout.
    const prefetch = () => {
      import('@/pages/BookNow').catch((err) => {
        if (import.meta.env?.DEV) console.warn('[book-route-preload]', err);
      });
    };
    const ric = window.requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(prefetch, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(prefetch, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLogoClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (e.currentTarget && typeof e.currentTarget.blur === 'function') e.currentTarget.blur();
    }
  };

  // Hidden mobile easter egg: one tap on the logo goes home (default Link
  // behavior), a double tap cycles the color theme (Night → Giants → Warriors).
  // Mobile only — bound solely to the mobile-bar logo and guarded by useIsMobile.
  const DOUBLE_TAP_MS = 260;
  const goHome = () => {
    if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate('/');
  };
  const handleMarkTap = (e) => {
    if (!isMobile) {
      // Desktop never reaches here (mobile bar is display:none), but stay safe:
      // fall back to the standard home-link behavior.
      handleLogoClick(e);
      return;
    }
    e.preventDefault();
    const s = tapState.current;
    s.count += 1;
    if (s.count === 1) {
      s.timer = window.setTimeout(() => {
        s.count = 0;
        goHome();
      }, DOUBLE_TAP_MS);
    } else {
      window.clearTimeout(s.timer);
      s.count = 0;
      cycleTheme();
    }
  };

  const close = () => setMobileOpen(false);
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  const handleSignOut = () => {
    signOut();
    close();
    navigate('/login');
  };

  const logoClass = "av-logo inline-flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center text-center leading-none";
  const linkClass = "inline-flex min-h-11 items-center justify-center text-center text-xs tracking-[0.18em] text-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap leading-none";
  const contactActionClass = "av-glass-widget inline-flex h-12 w-12 items-center justify-center rounded-full border text-foreground/74 transition-colors hover:text-foreground";
  const isActiveLink = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const internalToolRoute = location.pathname.startsWith('/admin')
    || location.pathname.startsWith('/provider')
    || location.pathname.startsWith('/members');
  // Auth screens own their chrome (each draws its own AVALON header), so the
  // marketing bar must not render over them — it crowds the card on desktop.
  const authRoute = ['/login', '/signup', '/nurses', '/forgot', '/forgot-password']
    .some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  // (navVisible is computed below from scroll direction on mobile.)
  const mobileLinks = [
    { to: BOOK_URL, label: 'Book', primary: true },
    ...mainLinks,
    ...(user ? [{ to: dashboardPathFor(user), label: 'Dashboard' }] : [{ to: '/login', label: 'Sign In' }]),
  ];

  // Sign-in / sign-up screens (customer + admin) intentionally DO show the
  // marketing bar — users mid-funnel need to get back to Plans / Book Now
  // without having to navigate out of the auth card first.
  const loginRoute = location.pathname === '/login'
    || location.pathname === '/admin/login'
    || location.pathname === '/signup';
  const internalChrome = !loginRoute && (internalToolRoute || authRoute);

  // Hide top nav on scroll-down (mobile only). The bottom BOOK bar is the
  // conversion anchor and stays pinned; hiding the top bar buys back ~64px
  // of viewport. iOS Safari pattern: scroll up by >8px or reach top → show.
  // Hook must run before any early return to keep Rules of Hooks compliant.
  const navHiddenByScroll = useNavHiddenOnScrollDown({
    enabled: globalShell && !internalChrome && isMobile && !mobileOpen && !focusMode,
  });
  const navVisible = !navHiddenByScroll;

  // Single persistent instance: <Navbar globalShell/> renders the bar for ALL
  // viewports from MobileShell — which sits OUTSIDE the page transition — so the bar
  // never remounts/refreshes on navigation. The bare per-page <Navbar/> calls
  // scattered across pages now draw nothing.
  if (!globalShell) return null;
  // Admin / provider / member areas own their chrome — no marketing bar there.
  if (internalChrome) return null;

  return (
    <motion.nav
      aria-hidden={!navVisible}
      inert={!navVisible ? '' : undefined}
      initial={false}
      animate={{ opacity: navVisible ? 1 : 0, y: navVisible ? 0 : -120 }}
      transition={{ duration: 0.32, ease: EASE }}
      className={`av-motion-rail fixed z-40 transition-all duration-700 ease-editorial ${
      mobileOpen && !focusMode
        ? 'left-3 right-3 top-2 md:top-4'
        : compact ? 'left-3 right-3 top-2 rounded-2xl md:top-4' : 'left-4 right-4 top-2 rounded-3xl md:top-4'
      }`}>
      {/* Desktop — 3-column grid: 1fr | auto | 1fr guarantees true center at every width.
          Gated at lg (not md): at the 768-1023 tablet band the centered links and the
          right cluster (contact icons + Sign In + Book Now) collide, so tablet keeps the
          compact hamburger bar below. Matches the hero's lg side-by-side breakpoint. */}
      <div
        className={`av-glass-menu hidden rounded-3xl border lg:grid items-center px-8 transition-all duration-500 ease-editorial ${
        compact ? 'h-12 px-4' : 'h-16'
        }`}
        style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}
      >

        {/* Col 1 — logo, left-aligned */}
        <div className="flex h-full items-center gap-4">
          {showBack && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 text-foreground transition-colors hover:bg-foreground/10"
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <Link
            to="/"
            onClick={handleLogoClick}
            aria-label="Avalon Vitality — home"
            className={`${logoClass} md:min-w-[9.5rem] md:items-start md:text-left`}
          >
            <AvalonMark className="h-[30px] w-[19px] text-foreground md:h-[40px] md:w-[26px]" />
            <span className="sr-only">Avalon Vitality home</span>
          </Link>
        </div>

        {/* Col 2 — nav links, auto width, inherently centered */}
        {!compact && !focusMode && (
          <div className="flex items-center justify-center gap-7">
            {mainLinks.map((link) => {
              const active = isActiveLink(link.to);
              const linkClassName = `relative inline-flex min-h-10 items-center justify-center px-1 text-center font-body text-[11px] uppercase leading-none tracking-[0.24em] transition-colors ${
                active ? 'text-foreground' : 'text-foreground/62 hover:text-foreground'
              }`;
              // IV Therapy gets a desktop-only hover mega-menu with 3 category tiles.
              if (link.to === '/protocols') {
                return <IVTherapyHover key={link.to} link={link} linkClassName={linkClassName} />;
              }
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={linkClassName}
                >
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Col 3 — account link + booking CTA, right-aligned */}
        <div className="flex h-full items-center justify-end gap-3">
          {/* Quick-dial icons are for prospects; hiding them when signed in keeps
              the logged-in nav (Sign Out + Dashboard + Book) from overflowing into
              the centered links. */}
          {!compact && !focusMode && !user && (
            <div className="flex items-center gap-1.5" aria-label="Contact Avalon">
              <a href={PHONE_URL} className={contactActionClass} aria-label={`Call Avalon ${PHONE_DISPLAY}`} title={`Call ${PHONE_DISPLAY}`}>
                <Phone className="h-4 w-4" strokeWidth={2} />
              </a>
              <a href={TEXT_URL} className={contactActionClass} aria-label="Text Avalon" title="Text Avalon">
                <MessageCircle className="h-4 w-4" strokeWidth={2} />
              </a>
            </div>
          )}
          {!compact && !focusMode && user && (
            <button
              type="button"
              onClick={handleSignOut}
              className={`${linkClass} gap-1`}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
              Sign Out
            </button>
          )}
          {!compact && !focusMode && user && <Link to={dashboardPathFor(user)} className={linkClass}>Dashboard</Link>}
          {!compact && !focusMode && !user && <Link to="/login" className={linkClass}>Sign In</Link>}
          {!compact && !focusMode && <PremiumButton
            as={Link}
            to={BOOK_URL}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground bg-foreground px-6 py-2.5 text-center font-body text-[11px] font-black uppercase leading-none tracking-[0.22em] text-background shadow-[0_18px_52px_hsl(var(--foreground)/0.16)] transition-colors hover:bg-foreground/90 hover:text-background"
          >
            Book Now
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" strokeWidth={2.2} />
          </PremiumButton>}
        </div>
      </div>

      {/* Mobile + tablet bar (shown below lg; desktop grid above takes over at lg) */}
      <div className={`av-glass-menu relative lg:hidden flex w-full min-w-0 items-center justify-between overflow-hidden rounded-[1.35rem] border px-3 transition-all duration-500 ease-editorial ${
        compact ? 'h-12' : 'h-14'
      }`}>
        <div className="flex h-full min-w-0 flex-1 items-center gap-3 pr-[8rem]">
          {showBack && (
            <button
              type="button"
              onClick={goBack}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <Link
            to="/"
            onClick={handleMarkTap}
            aria-label="Avalon Vitality — home"
            className={logoClass}
          >
            <AvalonMark className="h-[28px] w-[18px] text-foreground" />
            <span className="sr-only">Avalon Vitality home</span>
          </Link>
        </div>
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 shrink-0 items-center gap-0.5">
          {!focusMode && (
            <>
              <a
                href={PHONE_URL}
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/82 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`Call Avalon ${PHONE_DISPLAY}`}
              >
                <Phone className="h-5 w-5" strokeWidth={2} />
              </a>
              <a
                href={TEXT_URL}
                className="flex h-10 w-10 items-center justify-center rounded-full text-foreground/82 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Text Avalon"
              >
                <MessageCircle className="h-5 w-5" strokeWidth={2} />
              </a>
              <motion.button
                ref={mobileMenuButtonRef}
                onClick={() => setMobileOpen(!mobileOpen)}
                whileTap={premiumTap}
                className="mobile-menu-btn flex h-10 w-10 items-center justify-center rounded-full text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-panel"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={mobileOpen ? 'close' : 'menu'}
                    initial={{ opacity: 0, rotate: -18, scale: 0.85 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 18, scale: 0.85 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="block"
                  >
                    {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Dimmed backdrop — blocks clicks to the page beneath while the menu is
          open, and clicking it closes the menu. The mobile menu is below lg,
          so we hide the backdrop above lg too. */}
      {!focusMode && (
        <AnimatePresence>
          {mobileOpen && (
            <motion.button
              type="button"
              key="mobile-nav-backdrop"
              aria-label="Close menu"
              tabIndex={-1}
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm lg:hidden"
            />
          )}
        </AnimatePresence>
      )}

      {/* Mobile + tablet dropdown (below lg) */}
      {!focusMode && <div className="lg:hidden overflow-hidden px-2">
        <SmoothDisclosure open={mobileOpen} snapClosed className="pb-2" innerClassName="pb-0">
              <motion.div
                id="mobile-nav-panel"
                ref={mobilePanelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
                initial={false}
                animate={mobileOpen ? 'visible' : 'hidden'}
                variants={{
                  hidden: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
                }}
                className="av-mobile-dropdown-panel av-glass-menu relative z-40 grid gap-1.5 overflow-visible rounded-[1.35rem] border p-2"
              >
                {showBack && !compact && (
                  <motion.div
                    className="relative"
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } } }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        goBack();
                      }}
                      className="av-glass-widget relative flex min-h-[58px] w-full items-center justify-between rounded-2xl border px-4 font-body text-[11px] uppercase tracking-[0.22em] text-foreground/74 transition-colors hover:text-foreground"
                    >
                      <span>Back</span>
                      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </motion.div>
                )}

                <div className="relative grid gap-1.5">
                  {mobileLinks.map((item) => {
                  const active = isActiveLink(item.to);
                  return (
                    <motion.div
                      key={item.to}
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } } }}
                    >
                      <Link
                        to={item.to}
                        onClick={close}
                        className={`av-glass-widget group relative flex min-h-[58px] items-center justify-between rounded-2xl border px-4 font-body text-[11px] uppercase tracking-[0.24em] text-foreground transition-all duration-300 ${
                          item.primary
                            ? 'text-foreground ring-1 ring-foreground/18'
                            : active
                              ? 'text-foreground ring-1 ring-foreground/16'
                              : 'text-foreground/66 hover:text-foreground'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
                          item.primary
                            ? 'bg-foreground/60'
                            : active
                              ? 'bg-accent'
                              : 'bg-foreground/18 group-hover:bg-foreground/42'
                        }`} />
                      </Link>
                    </motion.div>
                  );
                })}
                </div>

                {user && (
                  <motion.div
                    className="relative mt-1"
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } } }}
                  >
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="av-glass-widget relative flex min-h-[58px] w-full items-center justify-between rounded-2xl border px-4 font-body text-[10px] uppercase tracking-[0.22em] text-foreground/52 transition-colors hover:text-foreground"
                    >
                      <span>Sign Out</span>
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </button>
                  </motion.div>
                )}

              </motion.div>
        </SmoothDisclosure>
      </div>}
    </motion.nav>
  );
}
