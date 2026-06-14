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
import { CartProvider } from '@/context/CartContext';
import { AuthStoreProvider, useAuthStore } from '@/lib/useAuthStore';
import PageTransition from '@/components/ui/PageTransition';
import { servicePillars } from '@/data/seoArchitecture';
import { captureAttribution, trackPageView } from '@/lib/analytics';

// Guard — redirects to /login if no active session; enforces role-based access
function RequireAuth({ children, allowedRoles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  const role = user.role ?? null;
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'nurse') return <Navigate to="/provider/shift" replace />;
    if (user.role === 'client') return <Navigate to="/members/dashboard" replace />;
    return <Navigate to="/login" replace />;
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
const Signup = lazyRoute(() => import('./pages/Signup'));
const ManageOrder = lazyRoute(() => import('./pages/ManageOrder'));
const AdminLogin = lazyRoute(() => import('./pages/AdminLogin'));
const MemberDashboard = lazyRoute(() => import('./pages/members/Dashboard'));
const MemberAccount = lazyRoute(() => import('./pages/members/Account'));
const MemberMessages = lazyRoute(() => import('./pages/members/Messages'));
const MemberBookings = lazyRoute(() => import('./pages/members/Bookings'));
const MemberMemberships = lazyRoute(() => import('./pages/members/Memberships'));
const MemberBilling = lazyRoute(() => import('./pages/members/Billing'));
const MemberDocuments = lazyRoute(() => import('./pages/members/Documents'));
const ProviderAccounting = lazyRoute(() => import('./pages/provider/Accounting'));
const ProviderAppointments = lazyRoute(() => import('./pages/provider/Appointments'));
const ProviderClients = lazyRoute(() => import('./pages/provider/Clients'));
const ProviderInvoicing = lazyRoute(() => import('./pages/provider/Invoicing'));
const ProviderServices = lazyRoute(() => import('./pages/provider/Services'));
const ProviderStaff = lazyRoute(() => import('./pages/provider/Staff'));
const ProviderCommunications = lazyRoute(() => import('./pages/provider/Communications'));
const NurseShift = lazyRoute(() => import('./pages/provider/NurseShift'));
const NurseDashboard = lazyRoute(() => import('./pages/provider/NurseDashboard'));
const RoleOS = lazyRoute(() => import('./pages/provider/RoleOS'));
const ProviderReports = lazyRoute(() => import('./pages/provider/Reports'));
const ProviderSettings = lazyRoute(() => import('./pages/provider/Settings'));
const EventPage = lazyRoute(() => import('./pages/EventPage'));
const EventPresale = lazyRoute(() => import('./pages/EventPresale'));
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
const NAD = lazyRoute(() => import('./pages/services/NAD'));
const CBD = lazyRoute(() => import('./pages/services/CBD'));
const PrivacyPolicy = lazyRoute(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazyRoute(() => import('./pages/TermsAndConditions'));
const TelehealthDisclaimer = lazyRoute(() => import('./pages/TelehealthDisclaimer'));
const ProductDisclaimer = lazyRoute(() => import('./pages/ProductDisclaimer'));
const NoticeOfPrivacyPractices = lazyRoute(() => import('./pages/NoticeOfPrivacyPractices'));
const Partners = lazyRoute(() => import('./pages/Partners'));
const Platform = lazyRoute(() => import('./pages/Platform'));
const B2B = lazyRoute(() => import('./pages/B2B'));
const B2BThankYou = lazyRoute(() => import('./pages/B2BThankYou'));
const CustomProtocol = lazyRoute(() => import('./pages/CustomProtocol'));
const CookiePolicy = lazyRoute(() => import('./pages/CookiePolicy'));
const ProtocolPage = lazyRoute(() => import('./pages/therapies/ProtocolPage'));
const ProductDetail = lazyRoute(() => import('./pages/products/ProductDetail'));
const Menu = lazyRoute(() => import('./pages/Menu'));
const BookingConfirmation = lazyRoute(() => import('./pages/BookingConfirmation'));
const Subscription = lazyRoute(() => import('./pages/Membership'));
const PlanCheckout = lazyRoute(() => import('./pages/PlanCheckout'));
const Corporate = lazyRoute(() => import('./pages/Corporate'));
const EventsPage = lazyRoute(() => import('./pages/Events'));
const Hotel = lazyRoute(() => import('./pages/Hotel'));
const ServiceArea = lazyRoute(() => import('./pages/ServiceArea'));
const PageNotFound = lazyRoute(() => import('./lib/PageNotFound'));
const NotFound = lazyRoute(() => import('./pages/NotFound'));
const Safety = lazyRoute(() => import('./pages/Safety'));
const Ingredients = lazyRoute(() => import('./pages/Ingredients'));
const MedicalDirection = lazyRoute(() => import('./pages/MedicalDirection'));
const Gift = lazyRoute(() => import('./pages/Gift'));
const Athlete = lazyRoute(() => import('./pages/Athlete'));
const Hangover = lazyRoute(() => import('./pages/Hangover'));
const JetLag = lazyRoute(() => import('./pages/JetLag'));
const Press = lazyRoute(() => import('./pages/Press'));
const AdminEssentials = lazyRoute(() => import('./pages/admin/AdminEssentials'));
const AdminAcuityControl = lazyRoute(() => import('./pages/admin/AcuityControl'));
const AdminAttioControl = lazyRoute(() => import('./pages/admin/AttioControl'));
const AdminFinanceControl = lazyRoute(() => import('./pages/admin/FinanceControl'));
const AdminCredentialControl = lazyRoute(() => import('./pages/admin/CredentialControl'));
const AdminDispatchControl = lazyRoute(() => import('./pages/admin/DispatchControl'));
const AdminFieldControl = lazyRoute(() => import('./pages/admin/FieldControl'));
const AdminKitControl = lazyRoute(() => import('./pages/admin/KitControl'));
const AdminTrainingControl = lazyRoute(() => import('./pages/admin/TrainingControl'));
const AdminInventory = lazyRoute(() => import('./pages/admin/Inventory'));
const AdminBookings = lazyRoute(() => import('./pages/admin/Bookings'));
const AdminEventsBackend = lazyRoute(() => import('./pages/admin/EventsBackend'));
const AdminClientHeatMap = lazyRoute(() => import('./pages/admin/ClientHeatMap'));


const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const timers = [];
    let cancelled = false;
    if (hash) {
      // Section anchor — wait for lazy components to mount, then scroll into view
      const id = hash.slice(1);
      let attempts = 0;
      const tryScroll = () => {
        if (cancelled) return;
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempts < 12) {
          attempts += 1;
          timers.push(setTimeout(tryScroll, 80));
        }
      };
      tryScroll();
    } else {
      window.scrollTo(0, 0);
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [pathname, hash]);
  return null;
};

const AnalyticsRouteTracker = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    captureAttribution(search);
    trackPageView({ path: `${pathname}${search}` });
  }, [pathname, search]);
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
      <a href="#main-content" className="skip-to-content" data-mobile-qa-ignore>Skip to content</a>
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
            {servicePillars.map((page) => (
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
            <Route path="/services/nad" element={<NAD />} />
            <Route path="/services/cbd" element={<CBD />} />
            <Route path="/products/iv-vitamins" element={<Navigate to="/protocols" replace />} />
            <Route path="/products/:category/:slug" element={<ProductDetail />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/launches/:slug" element={<EventPage />} />
            <Route path="/events/:slug" element={<EventPage />} />
            <Route path="/presale" element={<EventPresale />} />
            <Route path="/presale/:eventId" element={<EventPresale />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/membership" element={<Navigate to="/subscription" replace />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/plan" element={<PlanCheckout />} />
            <Route path="/corporate" element={<Corporate />} />
            <Route path="/launches" element={<EventsPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/hotel" element={<Hotel />} />
            <Route path="/service-area" element={<ServiceArea />} />
            <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Navigate to="/terms-of-service" replace />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/terms-of-service" element={<TermsAndConditions />} />
            <Route path="/telehealth-disclaimer" element={<TelehealthDisclaimer />} />
            <Route path="/product-disclaimer" element={<ProductDisclaimer />} />
            <Route path="/notice-of-privacy-practices" element={<NoticeOfPrivacyPractices />} />
            <Route path="/hipaa-notice" element={<Navigate to="/notice-of-privacy-practices" replace />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/cookies" element={<Navigate to="/cookie-policy" replace />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/platform" element={<Platform />} />
            <Route path="/b2b" element={<B2B />} />
            <Route path="/b2b/thank-you" element={<B2BThankYou />} />
            <Route path="/custom" element={<CustomProtocol />} />
            <Route path="/book" element={<BookNow />} />
            <Route path="/subscribe" element={<Navigate to="/subscription" replace />} />
            <Route path="/therapies/:slug" element={<ProtocolPage />} />
            <Route path="/protocols" element={<Menu />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/store" element={<Navigate to="/protocols" replace />} />
            <Route path="/store/confirmation" element={<Navigate to="/protocols" replace />} />
            <Route path="/booking/confirmation" element={<BookingConfirmation />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/order" element={<ManageOrder />} />
            <Route path="/redeem" element={<Navigate to="/order" replace />} />
            <Route path="/forgot" element={<Login />} />
            <Route path="/forgot-password" element={<Navigate to="/forgot" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/members" element={<Navigate to="/login" replace />} />
            <Route path="/members/dashboard" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberDashboard /></RequireAuth>} />
            <Route path="/members/account" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberAccount /></RequireAuth>} />
            <Route path="/members/messages" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberMessages /></RequireAuth>} />
            <Route path="/members/bookings" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberBookings /></RequireAuth>} />
            <Route path="/members/memberships" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberMemberships /></RequireAuth>} />
            <Route path="/members/billing" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberBilling /></RequireAuth>} />
            <Route path="/members/documents" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberDocuments /></RequireAuth>} />
            <Route path="/provider" element={<Navigate to="/login" replace />} />
            <Route path="/provider/dashboard" element={<RequireAuth allowedRoles={['nurse', 'admin']}><NurseDashboard /></RequireAuth>} />
            <Route path="/provider/appointments" element={<RequireAuth allowedRoles={['nurse', 'admin']}><ProviderAppointments /></RequireAuth>} />
            <Route path="/provider/clients" element={<RequireAuth allowedRoles={['nurse', 'admin']}><ProviderClients /></RequireAuth>} />
            <Route path="/provider/clients/:clientId" element={<RequireAuth allowedRoles={['nurse', 'admin']}><ProviderClients /></RequireAuth>} />
            <Route path="/provider/invoicing" element={<RequireAuth allowedRoles={['admin']}><ProviderInvoicing /></RequireAuth>} />
            <Route path="/provider/accounting" element={<RequireAuth allowedRoles={['admin']}><ProviderAccounting /></RequireAuth>} />
            <Route path="/provider/services" element={<RequireAuth allowedRoles={['admin']}><ProviderServices /></RequireAuth>} />
            <Route path="/provider/staff" element={<RequireAuth allowedRoles={['admin']}><ProviderStaff /></RequireAuth>} />
            <Route path="/provider/communications" element={<RequireAuth allowedRoles={['nurse', 'admin']}><ProviderCommunications /></RequireAuth>} />
            <Route path="/provider/acuity" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/appointments" replace /></RequireAuth>} />
            <Route path="/provider/crm" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin/crm" replace /></RequireAuth>} />
            <Route path="/provider/finance" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin/finance" replace /></RequireAuth>} />
            <Route path="/provider/credentials" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/settings" replace /></RequireAuth>} />
            <Route path="/provider/dispatch" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/shift" replace /></RequireAuth>} />
            <Route path="/provider/field" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/shift" replace /></RequireAuth>} />
            <Route path="/provider/kits" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/role-os?focus=inventory" replace /></RequireAuth>} />
            <Route path="/provider/training" element={<RequireAuth allowedRoles={['nurse', 'admin']}><Navigate to="/provider/role-os?focus=protocols" replace /></RequireAuth>} />
            <Route path="/provider/shift" element={<RequireAuth allowedRoles={['nurse', 'admin']}><NurseShift /></RequireAuth>} />
            <Route path="/provider/role-os" element={<RequireAuth allowedRoles={['nurse', 'admin']}><RoleOS /></RequireAuth>} />
            <Route path="/provider/reports" element={<RequireAuth allowedRoles={['admin']}><ProviderReports /></RequireAuth>} />
            <Route path="/provider/settings" element={<RequireAuth allowedRoles={['nurse', 'admin']}><ProviderSettings /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminEssentials /></RequireAuth>} />
            <Route path="/admin/acuity" element={<RequireAuth allowedRoles={['admin']}><AdminAcuityControl /></RequireAuth>} />
            <Route path="/admin/crm" element={<RequireAuth allowedRoles={['admin']}><AdminAttioControl /></RequireAuth>} />
            <Route path="/admin/finance" element={<RequireAuth allowedRoles={['admin']}><AdminFinanceControl /></RequireAuth>} />
            <Route path="/admin/credentials" element={<RequireAuth allowedRoles={['admin']}><AdminCredentialControl /></RequireAuth>} />
            <Route path="/admin/dispatch" element={<RequireAuth allowedRoles={['admin']}><AdminDispatchControl /></RequireAuth>} />
            <Route path="/admin/field" element={<RequireAuth allowedRoles={['admin']}><AdminFieldControl /></RequireAuth>} />
            <Route path="/admin/kits" element={<RequireAuth allowedRoles={['admin']}><AdminKitControl /></RequireAuth>} />
            <Route path="/admin/training" element={<RequireAuth allowedRoles={['admin']}><AdminTrainingControl /></RequireAuth>} />
            <Route path="/admin/communications" element={<RequireAuth allowedRoles={['admin']}><ProviderCommunications /></RequireAuth>} />
            <Route path="/admin/role-os" element={<RequireAuth allowedRoles={['admin']}><Navigate to="/admin" replace /></RequireAuth>} />
            <Route path="/admin/inventory" element={<RequireAuth allowedRoles={['admin']}><AdminInventory /></RequireAuth>} />
            <Route path="/admin/bookings" element={<RequireAuth allowedRoles={['admin']}><AdminBookings /></RequireAuth>} />
            <Route path="/admin/events" element={<RequireAuth allowedRoles={['admin']}><AdminEventsBackend /></RequireAuth>} />
            <Route path="/admin/client-heat-map" element={<RequireAuth allowedRoles={['admin']}><AdminClientHeatMap /></RequireAuth>} />
            <Route path="/admin/*" element={<RequireAuth allowedRoles={['admin']}><AdminEssentials /></RequireAuth>} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/gift" element={<Gift />} />
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
          <GlobalZoomState />
          <ScrollProgress />
          <MobileShell />
          <AppRoutes />
          <StickyBookBar />
        </Router>
        <Toaster />
        <CookieConsent />
      </CartProvider>
      </AuthStoreProvider>
    </ErrorBoundary>
  );
}

export default App;
