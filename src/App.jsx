import { Toaster } from '@/components/ui/toaster';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { useEffect, lazy, Suspense } from 'react';
import CookieConsent from '@/components/CookieConsent';
import ScrollProgress from '@/components/landing/ScrollProgress';
import ErrorBoundary from '@/components/ErrorBoundary';
import RouteFallback from '@/components/RouteFallback';
import AppLoader from '@/components/AppLoader';
import StickyBookBar from '@/components/landing/StickyBookBar';
import MobileShell from '@/components/MobileShell';
import MobilePublicFooter from '@/components/landing/MobilePublicFooter';
import CareAcuityForward from '@/components/CareAcuityForward';
import FrontDoorRedirect from '@/components/FrontDoorRedirect';
import { isFrontDoorHost } from '@/lib/frontDoor';
import { CBD_HIDDEN, isCbdRoutePath } from '@/lib/cbdVisibility';
import { CartProvider } from '@/context/CartContext';
import { AuthStoreProvider, useAuthStore } from '@/lib/useAuthStore';
import PageTransition from '@/components/ui/PageTransition';
import { servicePillars } from '@/data/seoArchitecture';
import { captureAttribution, trackPageView } from '@/lib/analytics';
import { canAccessAdminRoute } from '@/lib/adminAccess';
import { PAYOPS_FINANCE_CORE_ENABLED } from '@/lib/payOpsFinanceCore';
import { isPublicChromeRoute } from '@/lib/publicChrome';
import MfaGate from '@/components/auth/MfaGate';
import IdleWarning from '@/components/auth/IdleWarning';
import { adminDestinationForProviderPath, requiresPrivilegedMfa } from '@/lib/portalAccess';

// Operator-tier MFA enforcement. Off by default; flip VITE_MFA_ENFORCED=true
// (and the server's MFA_ENFORCED) only AFTER admins have enrolled a factor,
// or the gate would lock every admin out of /admin.
const MFA_ENFORCED = String(import.meta.env.VITE_MFA_ENFORCED || '').trim().toLowerCase() === 'true';
const AVALON_OS_BETA_ENABLED = String(import.meta.env.VITE_AVALON_OS_BETA || '').trim().toLowerCase() === 'true';

// Guard — redirects to /login if no active session; enforces role-based access
// Legacy /plans/checkout and /plan-checkout deep links carry ?price=&term=&sessions=
// query params that the /plan builder reads. A bare <Navigate to="/plan" /> would
// drop them and land the visitor on the default plan. This preserves search + hash
// so shared links keep working.
function PreserveSearchNavigate({ to }) {
  const loc = useLocation();
  return <Navigate to={{ pathname: to, search: loc.search, hash: loc.hash }} replace />;
}

function RequireAuth({ children, allowedRoles }) {
  const { user, loading, authBackend } = useAuthStore();
  const { pathname } = useLocation();
  if (loading && authBackend === 'supabase') return <RouteFallback />;
  if (!user) {
    // Admin stays on its dedicated, noindex sign-in surface even on the public
    // front-door hostname. This is the only protected portal allowed to bypass
    // the consumer /start bounce.
    if (pathname.startsWith('/admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    // The front door has no sign-in surface, so there is nowhere to send an
    // unauthenticated visitor except back to /start. This must be a DIRECT
    // bounce: routing them to /login instead would chain into the gate on that
    // route, and two <Navigate replace> in a row leaves the visitor stranded on
    // a blank page — React Router does not act on the second one.
    if (isFrontDoorHost()) return <Navigate to="/start" replace />;
    if (pathname.startsWith('/provider/')) {
      return <Navigate to={{ pathname: '/login', search: `?role=nurse&redirect=${encodeURIComponent(pathname)}` }} replace />;
    }
    if (pathname.startsWith('/organizer')) {
      return <Navigate to={{ pathname: '/login', search: `?portal=organizer&redirect=${encodeURIComponent(pathname)}` }} replace />;
    }
    return <Navigate to="/login" replace />;
  }
  // Admin force-set a temporary password — make them rotate it before anything else.
  if (user.mustChangePassword && pathname !== '/account/new-password') {
    return <Navigate to="/account/new-password" replace />;
  }
  const role = user.role ?? null;
  const adminProviderDestination = adminDestinationForProviderPath(pathname, user);
  if (adminProviderDestination) return <Navigate to={adminProviderDestination} replace />;
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'admin' || role === 'staff') return <Navigate to="/admin" replace />;
    if (['nurse', 'rn', 'np'].includes(user.role)) return <Navigate to="/provider/shifts" replace />;
    if (user.role === 'promoter') return <Navigate to="/organizer" replace />;
    if (user.role === 'client') return <Navigate to="/members/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }
  if ((role === 'admin' || role === 'staff') && pathname.startsWith('/admin') && !canAccessAdminRoute(role, pathname)) {
    return <Navigate to="/admin" replace />;
  }
  // Operator-tier step-up: force MFA enrollment/challenge before any admin/staff
  // route once enforcement is enabled. Lockout-safe — off until the flag flips.
  if (MFA_ENFORCED && requiresPrivilegedMfa(user) && !user.mfa?.verified) {
    return <MfaGate />;
  }
  return children;
}

const LAZY_ROUTE_RELOAD_KEY = 'avalon.lazy-route-reload.v1';
const CHUNK_ERROR_PATTERN = /dynamically imported module|importing a module script failed|loading chunk|modulepreload/i;

function lazyRoute(loader) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      const message = String(error?.message || error || '');
      if (CHUNK_ERROR_PATTERN.test(message) && typeof window !== 'undefined') {
        const alreadyReloaded = window.sessionStorage?.getItem(LAZY_ROUTE_RELOAD_KEY);
        if (!alreadyReloaded) {
          window.sessionStorage?.setItem(LAZY_ROUTE_RELOAD_KEY, '1');
          window.location.reload();
          return new Promise(() => {});
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      return loader();
    }
  });
}

import Home from './pages/Home';
const Checkout = lazyRoute(() => import('./pages/Checkout'));
const BookNow = lazyRoute(() => import('./pages/BookNow'));
const CheckoutSuccess = lazyRoute(() => import('./pages/CheckoutSuccess'));
const Login = lazyRoute(() => import('./pages/Login'));
const ForgotPassword = lazyRoute(() => import('./pages/ForgotPassword'));
const AuthCallback = lazyRoute(() => import('./pages/AuthCallback'));
const Nurses = lazyRoute(() => import('./pages/Nurses'));
const ManageOrder = lazyRoute(() => import('./pages/ManageOrder'));
const AdminLogin = lazyRoute(() => import('./pages/AdminLogin'));
const MemberDashboard = lazyRoute(() => import('./pages/members/Dashboard'));
const MemberBook = lazyRoute(() => import('./pages/members/Book'));
const MemberAccount = lazyRoute(() => import('./pages/members/Account'));
const MemberMessages = lazyRoute(() => import('./pages/members/Messages'));
const MemberBookings = lazyRoute(() => import('./pages/members/Bookings'));
const MemberMemberships = lazyRoute(() => import('./pages/members/Memberships'));
const MemberBilling = lazyRoute(() => import('./pages/members/Billing'));
const MemberDocuments = lazyRoute(() => import('./pages/members/Documents'));
const MembersSupport = lazyRoute(() => import('./pages/members/Support'));
const ProviderClients = lazyRoute(() => import('./pages/provider/Clients'));
const NurseSchedule = lazyRoute(() => import('./pages/provider/NurseSchedule'));
const NurseInvoices = lazyRoute(() => import('./pages/provider/NurseInvoices'));
const NurseGuidedShift = lazyRoute(() => import('../app-modules/pages/provider/NurseGuidedShift'));
const NurseWorkSettings = lazyRoute(() => import('../app-modules/pages/provider/NurseWorkSettings'));
const NurseKit = lazyRoute(() => import('./pages/provider/NurseKit'));
const OrganizerEventHub = lazyRoute(() => import('./pages/organizer/EventHub'));
const EventPage = lazyRoute(() => import('./pages/EventPage'));
const EventPresale = lazyRoute(() => import('./pages/EventPresale'));
const TripPage = lazyRoute(() => import('./pages/TripPage'));
const EventKiosk = lazyRoute(() => import('./pages/EventKiosk'));
const EventBoard = lazyRoute(() => import('./pages/EventBoard'));
const AdminEventServe = lazyRoute(() => import('./pages/admin/EventServe'));
const AdminEventBrand = lazyRoute(() => import('./pages/admin/EventBrand'));
const SeoPillarPage = lazyRoute(() => import('./pages/SeoPillarPage'));
const LocationPage = lazyRoute(() => import('./pages/LocationPage'));
const LocationsHub = lazyRoute(() => import('./pages/LocationPage').then((mod) => ({ default: mod.LocationsHub })));
const LearnPage = lazyRoute(() => import('./pages/LearnPage'));
const LearnHub = lazyRoute(() => import('./pages/LearnPage').then((mod) => ({ default: mod.LearnHub })));

// Home stays eager — it's the landing page, it needs to be instant.
// Everything else is code-split so the initial bundle is just the marketing shell.
const OurStory = lazyRoute(() => import('./pages/OurStory'));
const OurTeam = lazyRoute(() => import('./pages/OurTeam'));
const Apply = lazyRoute(() => import('./pages/Apply'));
const Careers = lazyRoute(() => import('./pages/Careers'));
const FAQPage = lazyRoute(() => import('./pages/FAQ'));
const PrivacyPolicy = lazyRoute(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazyRoute(() => import('./pages/TermsAndConditions'));
const TelehealthDisclaimer = lazyRoute(() => import('./pages/TelehealthDisclaimer'));
const ProductDisclaimer = lazyRoute(() => import('./pages/ProductDisclaimer'));
const Waiver = lazyRoute(() => import('./pages/Waiver'));
const NoticeOfPrivacyPractices = lazyRoute(() => import('./pages/NoticeOfPrivacyPractices'));
const Partners = lazyRoute(() => import('./pages/Partners'));
const Platform = lazyRoute(() => import('./pages/Platform'));
const B2B = lazyRoute(() => import('./pages/B2B'));
const B2BThankYou = lazyRoute(() => import('./pages/B2BThankYou'));
const CustomProtocol = lazyRoute(() => import('./pages/CustomProtocol'));
const CookiePolicy = lazyRoute(() => import('./pages/CookiePolicy'));
const ProtocolPage = lazyRoute(() => import('./pages/therapies/ProtocolPage'));
const ProductDetail = lazyRoute(() => import('./pages/ConsumerProduct'));
const Menu = lazyRoute(() => import('./pages/ConsumerMenu'));
const BookingConfirmation = lazyRoute(() => import('./pages/BookingConfirmation'));
const Subscription = lazyRoute(() => import('./pages/PlanInterest'));
const PlanCheckout = lazyRoute(() => import('./pages/PlanCheckout'));
const Corporate = lazyRoute(() => import('./pages/Corporate'));
const EventsPage = lazyRoute(() => import('./pages/Events'));
const CannabisCeNight = lazyRoute(() => import('./pages/CannabisCeNight'));
const NurseDelivery = lazyRoute(() => import('./pages/NurseDelivery'));
const RequestReceived = lazyRoute(() => import('./pages/RequestReceived'));
const StartDeposit    = lazyRoute(() => import('./pages/StartDeposit'));
const Vitalice = lazyRoute(() => import('./pages/Vitalice'));
const NurseInvoice = lazyRoute(() => import('./pages/NurseInvoice'));
const NurseLogin = lazyRoute(() => import('./pages/NurseLogin'));
const Hotel = lazyRoute(() => import('./pages/Hotel'));
const Gift = lazyRoute(() => import('./pages/Gift'));
const ServiceArea = lazyRoute(() => import('./pages/ServiceArea'));
const PageNotFound = lazyRoute(() => import('./lib/PageNotFound'));
const NotFound = lazyRoute(() => import('./pages/NotFound'));
const Safety = lazyRoute(() => import('./pages/Safety'));
const Support = lazyRoute(() => import('./pages/Support'));
const Ingredients = lazyRoute(() => import('./pages/Ingredients'));
const MedicalDirection = lazyRoute(() => import('./pages/MedicalDirection'));
const Athlete = lazyRoute(() => import('./pages/Athlete'));
const Hangover = lazyRoute(() => import('./pages/Hangover'));
const JetLag = lazyRoute(() => import('./pages/JetLag'));
const Press = lazyRoute(() => import('./pages/Press'));
const AdminEssentials = lazyRoute(() => import('./pages/admin/AdminEssentials'));
const AdminAcuityControl = lazyRoute(() => import('./pages/admin/AcuityControl'));
const AdminHubspotControl = lazyRoute(() => import('./pages/admin/HubspotControl'));
const AdminPatientRecords = lazyRoute(() => import('./pages/admin/PatientRecords'));
const AdminClientDetail = lazyRoute(() => import('./pages/admin/ClientDetail'));
const AdminMemberships = lazyRoute(() => import('./pages/admin/Memberships'));
const AdminMessages = lazyRoute(() => import('./pages/admin/Messages'));
const AdminInbox = lazyRoute(() => import('./pages/admin/Inbox'));
const AdminTeamInbox = lazyRoute(() => import('./pages/admin/TeamInbox'));
const AdminGfeSettings = lazyRoute(() => import('./pages/admin/GfeSettings'));
const AdminFinanceControl = lazyRoute(() => import('./pages/admin/FinanceControl'));
const AdminPayables = lazyRoute(() => import('./pages/admin/Payables'));
const AdminPayroll = lazyRoute(() => import('./pages/admin/Payroll'));
const AdminVendorPayments = lazyRoute(() => import('./pages/admin/VendorPayments'));
const AdminInventoryCosts = lazyRoute(() => import('./pages/admin/InventoryCosts'));
const AdminSharedInventory = lazyRoute(() => import('./pages/admin/SharedInventory'));
const AdminNurseInvoices = lazyRoute(() => import('./pages/admin/NurseInvoices'));
const AdminSchedulingControl = lazyRoute(() => import('./pages/admin/SchedulingControl'));
const AdminCredentialControl = lazyRoute(() => import('./pages/admin/CredentialControl'));
const AdminDispatchControl = lazyRoute(() => import('./pages/admin/DispatchControl'));
const AdminFieldControl = lazyRoute(() => import('./pages/admin/FieldControl'));
const AdminKitControl = lazyRoute(() => import('./pages/admin/KitControl'));
const AdminTrainingControl = lazyRoute(() => import('./pages/admin/TrainingControl'));
const AdminOsCapability = lazyRoute(() => import('./pages/admin/OsCapability'));
const AdminBookings = lazyRoute(() => import('./pages/admin/Bookings'));
const AdminEventsBackend = lazyRoute(() => import('./pages/admin/EventsBackend'));
const AdminClientHeatMap = lazyRoute(() => import('./pages/admin/ClientHeatMap'));
const AdminTeamSettings = lazyRoute(() => import('./pages/admin/TeamSettings'));
const AdminEmailTemplates = lazyRoute(() => import('./pages/admin/EmailTemplates'));
const AdminPromoCodes = lazyRoute(() => import('./pages/admin/PromoCodes'));
const AdminRefunds = lazyRoute(() => import('./pages/admin/Refunds'));
const AdminDeletionRequests = lazyRoute(() => import('./pages/admin/DeletionRequests'));
const AdminExpiringCredits = lazyRoute(() => import('./pages/admin/ExpiringCredits'));
const AdminReviews = lazyRoute(() => import('./pages/admin/Reviews'));
const AdminAvalonBD = lazyRoute(() => import('./pages/admin/AvalonBD'));
const AdminSupportTickets = lazyRoute(() => import('./pages/admin/SupportTickets'));
const AdminReconciliation = lazyRoute(() => import('./pages/admin/Reconciliation'));
const Review = lazyRoute(() => import('./pages/Review'));
const MemberRedeemGift = lazyRoute(() => import('./pages/members/RedeemGift'));
const InviteAccept = lazyRoute(() => import('./pages/InviteAccept'));
const NewPassword = lazyRoute(() => import('./pages/NewPassword'));


const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const timers = [];
    let cancelled = false;
    // Reset first so lazy pages never inherit the previous route's scroll offset,
    // even when a hash anchor's target is still mounting.
    window.scrollTo(0, 0);
    if (hash) {
      const id = hash.slice(1);
      let attempts = 0;
      const tryScroll = () => {
        if (cancelled) return;
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
        } else if (attempts < 12) {
          attempts += 1;
          timers.push(setTimeout(tryScroll, 80));
        }
      };
      tryScroll();
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [pathname, hash]);
  return null;
};

// Intake routes never emit a page view. localAnalyticsProvider writes the event
// to localStorage BEFORE the consent gate, so excluding the route removes the
// write entirely — stronger than sanitizing the payload. Attribution still runs:
// it reads an allowlist of UTM/click-id keys only, so it carries no PII.
const ANALYTICS_EXCLUDED_ROUTES = /^\/(start|nurse-delivery|support|vitalice)(\/|$)/;

const AnalyticsRouteTracker = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    captureAttribution(search);
    if (ANALYTICS_EXCLUDED_ROUTES.test(pathname)) return;
    trackPageView({ path: pathname });
  }, [pathname, search]);
  return null;
};

// Keeps html.av-cream in sync across client-side navigation. The initial value
// is set pre-paint by public/theme-bootstrap.js (same predicate) so the first
// render never flashes dark; this only handles route changes after mount.
// The dedicated Avalon OS beta uses the cream editorial theme everywhere.
// Production portals retain their current dark appearance, except Admin and
// the unified login, which use the cream product surface.
const PORTAL_PREFIX = /^\/(provider|admin|members|account|organizer|kiosk|signup|forgot|forgot-password)(\/|$)/;
const ADMIN_PREFIX = /^\/admin(\/|$)/;

const ConsumerThemeSync = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const adminCream = ADMIN_PREFIX.test(pathname);
    const consumerCream = AVALON_OS_BETA_ENABLED || !PORTAL_PREFIX.test(pathname);
    document.documentElement.classList.toggle('av-cream', consumerCream);
    document.documentElement.classList.toggle('av-admin-cream', adminCream);
    document.documentElement.style.colorScheme = adminCream || consumerCream ? 'light' : 'dark';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', adminCream || consumerCream ? '#f6f2eb' : 'rgb(43, 33, 27)');
    });
    document.documentElement.classList.toggle('av-browser-espresso', isPublicChromeRoute(pathname));
  }, [pathname]);
  return null;
};

const GlobalZoomState = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const scale = Number(viewport?.scale || 1);
        const zoomed = scale > 1.01;
        root.classList.toggle('av-user-zoomed', zoomed);
        root.style.setProperty('--av-visual-viewport-scale', scale.toFixed(3));
      });
    };

    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.cancelAnimationFrame(frame);
      root.classList.remove('av-user-zoomed');
      root.style.removeProperty('--av-visual-viewport-scale');
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return null;
};

function AppRoutes() {
  const location = useLocation();
  return (
    <>
      {/* Skip link inside a labeled <nav> so axe-core's region check sees it
          as content inside a landmark instead of a loose <a> at the root. */}
      <nav aria-label="Skip navigation">
        <a href="#main-content" className="skip-to-content" data-mobile-qa-ignore>Skip to content</a>
      </nav>
      <div id="main-content" tabIndex={-1} className="relative z-10 outline-none">
        {/* mode="wait" → outgoing page fully crossfades out before the next fades in
            (avoids two stacked pages / two fixed navbars). initial={false} → no fade
            on first load, so hero first paint is unchanged. Stage transition is
            opacity-only (see PageTransition) to keep the fixed Navbar pinned. */}
        <AnimatePresence mode="wait" initial={false}>
        <PageTransition key={location.pathname}>
          <Suspense fallback={<RouteFallback />}>
            <Routes location={location}>
            <Route path="/" element={<Home />} />
            {servicePillars
              .filter((page) => !(CBD_HIDDEN && isCbdRoutePath(page.path)))
              .map((page) => (
                <Route key={page.path} path={page.path} element={<SeoPillarPage />} />
              ))}
            <Route path="/locations" element={<LocationsHub />} />
            <Route path="/locations/:slug" element={<LocationPage />} />
            <Route path="/learn" element={<LearnHub />} />
            <Route path="/learn/:slug" element={<LearnPage />} />
            <Route path="/our-story" element={<OurStory />} />
            <Route path="/team" element={<OurTeam />} />
            <Route path="/medical-direction" element={<MedicalDirection />} />
            <Route path="/our-team" element={<Navigate to="/team" replace />} />
            <Route path="/products/dehydration-iv" element={<Navigate to="/products/iv-vitamins/dehydration" replace />} />
            <Route path="/services/iv-vitamins" element={<Navigate to="/protocols" replace />} />
            <Route path="/services/nad" element={<Navigate to="/protocols#iv-nad" replace />} />
            <Route path="/services/cbd" element={CBD_HIDDEN ? <NotFound /> : <Navigate to="/protocols#iv-cbd" replace />} />
            <Route path="/products/iv-vitamins" element={<Navigate to="/protocols" replace />} />
            <Route path="/products/:category/:slug" element={<ProductDetail />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/launches/:slug" element={<EventPage />} />
            <Route path="/events/:slug/kiosk" element={<EventKiosk />} />
            <Route path="/events/:slug/board" element={<EventBoard />} />
            <Route path="/events/cannabis-ce" element={CBD_HIDDEN ? <NotFound /> : <CannabisCeNight />} />
            {/* /start is the canonical short URL for the focused booking screen.
                /nurse-delivery stays for existing links and the ?path=guided flow. */}
            <Route path="/start" element={<NurseDelivery entry="book" />} />
            <Route path="/start/received" element={<RequestReceived />} />
            <Route path="/start/deposit"   element={<StartDeposit />} />
            <Route path="/nurse-delivery" element={<NurseDelivery />} />
            {/* Vital Ice × Avalon co-branded appointment intake.
                Separate Cognito form; same PHI posture as /start. */}
            <Route path="/vitalice" element={<Vitalice />} />
            {/* Contractor pay form. Deliberately NOT wrapped in FrontDoorRedirect:
                it carries no PHI and has to run on the apex, which is a front-door
                host. Its own password gate is server-side (api/invoice/unlock). */}
            <Route path="/invoice" element={<NurseInvoice />} />
            <Route path="/nurse-login" element={<NurseLogin />} />
            <Route path="/events/:slug" element={<EventPage />} />
            <Route path="/presale" element={<EventPresale />} />
            <Route path="/presale/:eventId" element={<EventPresale />} />
            <Route path="/trips" element={<Navigate to="/events" replace />} />
            <Route path="/trips/:visitId" element={<TripPage />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/faq" element={<FAQPage />} />
            {/* Plans + plan checkout are pulled for now (2026-07-29). Redirected
                rather than 404'd: ~18 internal links and any live inbound link
                still land somewhere useful. Subscription/PlanCheckout stay
                imported and unreachable — restore by swapping these back. */}
            <Route path="/membership" element={<Navigate to="/start" replace />} />
            <Route path="/subscription" element={<Navigate to="/start" replace />} />
            <Route path="/plan" element={<Navigate to="/start" replace />} />
            <Route path="/corporate" element={<Corporate />} />
            <Route path="/launches" element={<EventsPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/hotel" element={<Hotel />} />
            <Route path="/gift" element={AVALON_OS_BETA_ENABLED ? <Gift /> : <NotFound />} />
            <Route path="/service-area" element={<ServiceArea />} />
            <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Navigate to="/terms-of-service" replace />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/terms-of-service" element={<TermsAndConditions />} />
            <Route path="/telehealth-disclaimer" element={<TelehealthDisclaimer />} />
            <Route path="/product-disclaimer" element={<ProductDisclaimer />} />
            <Route path="/waiver" element={<Waiver />} />
            <Route path="/liability-waiver" element={<Navigate to="/waiver" replace />} />
            <Route path="/notice-of-privacy-practices" element={<NoticeOfPrivacyPractices />} />
            <Route path="/hipaa-notice" element={<Navigate to="/notice-of-privacy-practices" replace />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/cookies" element={<Navigate to="/cookie-policy" replace />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/b2b" element={<B2B />} />
            <Route path="/b2b/thank-you" element={<B2BThankYou />} />
            {/* PHI-collecting routes. CareAcuityForward stays OUTERMOST so apex/
                www/care behavior is bit-for-bit unchanged (it returns null and
                hard-navigates to Acuity before FrontDoorRedirect ever mounts).
                FrontDoorRedirect only fires on the front-door host, where these
                funnels must be unreachable — see src/lib/frontDoor.js. */}
            <Route path="/custom" element={<CareAcuityForward><FrontDoorRedirect><CustomProtocol /></FrontDoorRedirect></CareAcuityForward>} />
            <Route path="/book" element={<CareAcuityForward><FrontDoorRedirect><BookNow /></FrontDoorRedirect></CareAcuityForward>} />
            <Route path="/booking" element={<Navigate to="/book" replace />} />
            <Route path="/book-now" element={<Navigate to="/book" replace />} />
            <Route path="/subscribe" element={<Navigate to="/subscription" replace />} />
            {/* Common URL guesses → canonical routes. Captures muscle memory
                and competitor patterns that would otherwise hit the 404. */}
            {/* Sign-in aliases are gated HERE rather than relying on the gate on
                /login. Chaining two <Navigate replace> in one commit does not
                work — React Router swallows the second, and the visitor is left
                on a blank /login. Each alias must resolve in ONE navigation. */}
            <Route path="/signin" element={<FrontDoorRedirect><Navigate to="/login" replace /></FrontDoorRedirect>} />
            <Route path="/sign-in" element={<FrontDoorRedirect><Navigate to="/login" replace /></FrontDoorRedirect>} />
            <Route path="/services" element={<Navigate to="/protocols" replace />} />
            <Route path="/providers" element={<Navigate to="/nurses" replace />} />
            <Route path="/provider/login" element={<FrontDoorRedirect><Navigate to="/login" replace /></FrontDoorRedirect>} />
            {/* Deep-link recovery — audit findings N2-N5. Nurse SMS invites,
                marketing-cadence /iv-therapy links, muscle-memory /dashboard
                and /kiosk should route somewhere useful, not 404. */}
            <Route path="/nurse" element={<Navigate to="/nurse-login" replace />} />
            <Route path="/iv-therapy" element={<Navigate to="/protocols" replace />} />
            <Route path="/dashboard" element={<FrontDoorRedirect><Navigate to="/members/dashboard" replace /></FrontDoorRedirect>} />
            <Route path="/kiosk" element={<FrontDoorRedirect><Navigate to="/login?next=/kiosk" replace /></FrontDoorRedirect>} />
            <Route path="/plans" element={<Navigate to="/start" replace />} />
            <Route path="/plans/checkout" element={<Navigate to="/start" replace />} />
            <Route path="/plan-checkout" element={<Navigate to="/start" replace />} />
            <Route path="/therapies/:slug" element={<ProtocolPage />} />
            <Route path="/protocols" element={<Menu />} />
            {/* /menu canonicalized to /protocols — both surfaces served the
                same component, splitting SEO equity between two URLs. */}
            <Route path="/menu" element={<Navigate to="/protocols" replace />} />
            <Route path="/store" element={<Navigate to="/protocols" replace />} />
            <Route path="/store/confirmation" element={<Navigate to="/protocols" replace />} />
            <Route path="/booking/confirmation" element={<CareAcuityForward><FrontDoorRedirect><BookingConfirmation /></FrontDoorRedirect></CareAcuityForward>} />
            <Route path="/checkout" element={<CareAcuityForward><FrontDoorRedirect><Checkout /></FrontDoorRedirect></CareAcuityForward>} />
            <Route path="/checkout/success" element={<CareAcuityForward><FrontDoorRedirect><CheckoutSuccess /></FrontDoorRedirect></CareAcuityForward>} />
            {/* One shared sign-in surface for members, nurses, admins, and event
                organizers. It is intentionally available on the main URL; the
                clinical and account routes behind it keep their own guards. */}
            <Route path="/login" element={<Login defaultAudience="admin" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/nurses" element={<Nurses />} />
            <Route path="/order" element={<FrontDoorRedirect><ManageOrder /></FrontDoorRedirect>} />
            <Route path="/redeem" element={<Navigate to="/order" replace />} />
            <Route path="/forgot" element={<FrontDoorRedirect><ForgotPassword /></FrontDoorRedirect>} />
            <Route path="/forgot-password" element={<Navigate to="/forgot" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/invite/accept" element={<InviteAccept />} />
            <Route path="/account/new-password" element={<NewPassword />} />
            <Route path="/members" element={<FrontDoorRedirect><Navigate to="/login" replace /></FrontDoorRedirect>} />
            <Route path="/organizer/login" element={<Navigate to="/login?portal=organizer" replace />} />
            <Route path="/organizer" element={<RequireAuth allowedRoles={['promoter', 'admin']}><OrganizerEventHub /></RequireAuth>} />
            <Route path="/members/dashboard" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberDashboard /></RequireAuth>} />
            <Route path="/members/book" element={<RequireAuth allowedRoles={['client', 'admin', 'staff']}><MemberBook /></RequireAuth>} />
            {/* The account surface is the one member page whose every panel
                calls a now-server-gated api/me/* route (profile, payment
                methods, password, unlink, delete-request). Without this a
                logged-in user on the front door would mount the page and see
                raw 409s. FrontDoorRedirect goes OUTSIDE RequireAuth so the
                bounce to /start happens before the auth check.
                NOTE: the canonical path is /members/account — there is no
                top-level /account route (only /account/new-password). */}
            <Route path="/members/account" element={<FrontDoorRedirect><RequireAuth allowedRoles={['client', 'admin']}><MemberAccount /></RequireAuth></FrontDoorRedirect>} />
            <Route path="/members/messages" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberMessages /></RequireAuth>} />
            <Route path="/members/bookings" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberBookings /></RequireAuth>} />
            <Route path="/members/memberships" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberMemberships /></RequireAuth>} />
            <Route path="/members/billing" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberBilling /></RequireAuth>} />
            <Route path="/members/documents" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberDocuments /></RequireAuth>} />
            <Route path="/members/support" element={<RequireAuth allowedRoles={['client', 'admin']}><MembersSupport /></RequireAuth>} />
            <Route path="/provider" element={<Navigate to="/provider/shifts" replace />} />
            <Route path="/provider/shifts" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><NurseSchedule /></RequireAuth>} />
            <Route path="/provider/shifts/:shiftId" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><NurseGuidedShift /></RequireAuth>} />
            <Route path="/provider/shifts/:shiftId/run" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><NurseGuidedShift /></RequireAuth>} />
            <Route path="/provider/invoices" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><NurseInvoices /></RequireAuth>} />
            <Route path="/provider/settings" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><NurseWorkSettings /></RequireAuth>} />
            <Route path="/provider/today" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/dashboard" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/appointments" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/clients" element={<RequireAuth allowedRoles={['nurse', 'admin']}><ProviderClients /></RequireAuth>} />
            <Route path="/provider/clients/:clientId" element={<RequireAuth allowedRoles={['nurse', 'admin']}><ProviderClients /></RequireAuth>} />
            <Route path="/provider/invoicing" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/provider/invoices" replace /></RequireAuth>} />
            <Route path="/provider/accounting" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/provider/invoices" replace /></RequireAuth>} />
            <Route path="/provider/services" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/staff" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/communications" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/acuity" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/appointments" replace /></RequireAuth>} />
            <Route path="/provider/crm" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin/crm" replace /></RequireAuth>} />
            <Route path="/provider/finance" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin/finance" replace /></RequireAuth>} />
            <Route path="/provider/credentials" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/settings" replace /></RequireAuth>} />
            <Route path="/provider/dispatch" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/field" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/kit" element={PAYOPS_FINANCE_CORE_ENABLED ? <RequireAuth allowedRoles={['nurse', 'rn', 'np']}><NurseKit /></RequireAuth> : <NotFound />} />
            <Route path="/provider/kits" element={PAYOPS_FINANCE_CORE_ENABLED
              ? <RequireAuth allowedRoles={['nurse', 'rn', 'np']}><Navigate to="/provider/kit" replace /></RequireAuth>
              : <RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/training" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/shift" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/role-os" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/shifts" replace /></RequireAuth>} />
            <Route path="/provider/reports" element={<RequireAuth allowedRoles={['nurse', 'rn', 'np', 'admin']}><Navigate to="/provider/invoices" replace /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminEssentials /></RequireAuth>} />
            <Route path="/admin/acuity" element={<RequireAuth allowedRoles={['admin']}><AdminAcuityControl /></RequireAuth>} />
            <Route path="/admin/clients" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminPatientRecords /></RequireAuth>} />
            <Route path="/admin/clients/:id" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminClientDetail /></RequireAuth>} />
            <Route path="/admin/memberships" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminMemberships /></RequireAuth>} />
            <Route path="/admin/messages" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminMessages /></RequireAuth>} />
            <Route path="/admin/inbox" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminInbox /></RequireAuth>} />
            <Route path="/admin/team-inbox" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminTeamInbox /></RequireAuth>} />
            <Route path="/admin/gfe" element={<RequireAuth allowedRoles={['admin']}><AdminGfeSettings /></RequireAuth>} />
            <Route path="/admin/crm" element={<Navigate to="/admin/hubspot" replace />} />
            <Route path="/admin/hubspot" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminHubspotControl /></RequireAuth>} />
            <Route path="/admin/finance" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminFinanceControl /></RequireAuth>} />
            <Route path="/admin/payables" element={PAYOPS_FINANCE_CORE_ENABLED ? <RequireAuth allowedRoles={['admin']}><AdminPayables /></RequireAuth> : <NotFound />} />
            <Route path="/admin/payroll" element={PAYOPS_FINANCE_CORE_ENABLED ? <RequireAuth allowedRoles={['admin']}><AdminPayroll /></RequireAuth> : <NotFound />} />
            <Route path="/admin/vendor-payments" element={PAYOPS_FINANCE_CORE_ENABLED ? <RequireAuth allowedRoles={['admin']}><AdminVendorPayments /></RequireAuth> : <NotFound />} />
            <Route path="/admin/inventory-costs" element={PAYOPS_FINANCE_CORE_ENABLED ? <RequireAuth allowedRoles={['admin']}><AdminInventoryCosts /></RequireAuth> : <NotFound />} />
            <Route path="/admin/nurse-invoices" element={<RequireAuth allowedRoles={['admin']}><AdminNurseInvoices /></RequireAuth>} />
            <Route path="/admin/scheduling" element={<RequireAuth allowedRoles={['admin']}><AdminSchedulingControl /></RequireAuth>} />
            <Route path="/admin/credentials" element={<RequireAuth allowedRoles={['admin']}><AdminCredentialControl /></RequireAuth>} />
            <Route path="/admin/dispatch" element={<RequireAuth allowedRoles={['admin']}><AdminDispatchControl /></RequireAuth>} />
            <Route path="/admin/field" element={<RequireAuth allowedRoles={['admin']}><AdminFieldControl /></RequireAuth>} />
            <Route path="/admin/kits" element={PAYOPS_FINANCE_CORE_ENABLED
              ? <RequireAuth allowedRoles={['admin']}><Navigate to="/admin/inventory?view=kits" replace /></RequireAuth>
              : <RequireAuth allowedRoles={['admin']}><AdminKitControl /></RequireAuth>} />
            <Route path="/admin/training" element={<RequireAuth allowedRoles={['admin']}><AdminTrainingControl /></RequireAuth>} />
            <Route path="/admin/communications" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin/messages" replace /></RequireAuth>} />
            <Route path="/admin/role-os" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin" replace /></RequireAuth>} />
            <Route path="/admin/inventory" element={PAYOPS_FINANCE_CORE_ENABLED
              ? <RequireAuth allowedRoles={['admin']}><AdminSharedInventory /></RequireAuth>
              : <RequireAuth allowedRoles={['admin']}><Navigate to="/admin" replace /></RequireAuth>} />
            <Route path="/admin/bookings" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminBookings /></RequireAuth>} />
            <Route path="/admin/team" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminTeamSettings /></RequireAuth>} />
            <Route path="/admin/email-templates" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminEmailTemplates /></RequireAuth>} />
            <Route path="/admin/promo-codes" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminPromoCodes /></RequireAuth>} />
            <Route path="/admin/shift-marketplace" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin/scheduling" replace /></RequireAuth>} />
            <Route path="/admin/refunds" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminRefunds /></RequireAuth>} />
            <Route path="/admin/deletion-requests" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminDeletionRequests /></RequireAuth>} />
            <Route path="/admin/expiring-credits" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminExpiringCredits /></RequireAuth>} />
            <Route path="/admin/reviews" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminReviews /></RequireAuth>} />
            <Route path="/admin/bd/*" element={<RequireAuth allowedRoles={['admin']}><AdminAvalonBD /></RequireAuth>} />
            <Route path="/admin/support-tickets" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminSupportTickets /></RequireAuth>} />
            <Route path="/admin/reconciliation" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminReconciliation /></RequireAuth>} />
            <Route path="/admin/os/:capability" element={AVALON_OS_BETA_ENABLED ? <RequireAuth allowedRoles={['admin', 'staff']}><AdminOsCapability /></RequireAuth> : <NotFound />} />
            <Route path="/admin/events/:slug/serve" element={<RequireAuth allowedRoles={['admin', 'staff', 'nurse', 'rn', 'np', 'physician', 'medical_director']}><AdminEventServe /></RequireAuth>} />
            <Route path="/admin/events/:slug/brand" element={<RequireAuth allowedRoles={['admin', 'staff']}><AdminEventBrand /></RequireAuth>} />
            <Route path="/admin/events" element={<RequireAuth allowedRoles={['admin']}><AdminEventsBackend /></RequireAuth>} />
            <Route path="/admin/client-heat-map" element={<RequireAuth allowedRoles={['admin']}><AdminClientHeatMap /></RequireAuth>} />
            <Route path="/admin/*" element={<RequireAuth allowedRoles={['admin']}><AdminEssentials /></RequireAuth>} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/support" element={<Support />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/review" element={<FrontDoorRedirect><Review /></FrontDoorRedirect>} />
            <Route path="/members/redeem" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberRedeemGift /></RequireAuth>} />
            <Route path="/athlete" element={<Athlete />} />
            <Route path="/hangover" element={<Hangover />} />
            <Route path="/jet-lag" element={<JetLag />} />
            <Route path="/press" element={<Press />} />
            <Route path="/pricing" element={<Navigate to="/subscription" replace />} />
            <Route path="/newsletter" element={<Navigate to="/subscription" replace />} />
            <Route path="/waitlist" element={<Navigate to="/book" replace />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </PageTransition>
        </AnimatePresence>
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthStoreProvider>
      <CartProvider>
        <AppLoader />
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <AnalyticsRouteTracker />
          <ConsumerThemeSync />
          <GlobalZoomState />
          <ScrollProgress />
          <MobileShell />
          <AppRoutes />
          <MobilePublicFooter />
          <StickyBookBar />
          <CookieConsent />
          <IdleWarning />
        </Router>
        <Toaster />
      </CartProvider>
      </AuthStoreProvider>
    </ErrorBoundary>
  );
}

export default App;
