import { Toaster } from '@/components/ui/toaster';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import CookieConsent from '@/components/CookieConsent';
import ScrollProgress from '@/components/landing/ScrollProgress';
import BottomNav from '@/components/landing/BottomNav';
import ErrorBoundary from '@/components/ErrorBoundary';
import RouteFallback from '@/components/RouteFallback';
import { CartProvider } from '@/context/CartContext';
import { AuthStoreProvider, useAuthStore } from '@/lib/useAuthStore';
import AppLoader from '@/components/AppLoader';

// Guard — redirects to /login if no active session; enforces role-based access
function RequireAuth({ children, allowedRoles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'provider') return <Navigate to="/provider/shift" replace />;
    if (user.role === 'client') return <Navigate to="/members/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}
import Home from './pages/Home';
const Checkout = lazy(() => import('./pages/Checkout'));
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'));
const Login = lazy(() => import('./pages/Login'));
const MemberDashboard = lazy(() => import('./pages/members/Dashboard'));
const ProviderDashboard = lazy(() => import('./pages/provider/Dashboard'));
const ProviderAccounting = lazy(() => import('./pages/provider/Accounting'));
const ProviderAppointments = lazy(() => import('./pages/provider/Appointments'));
const ProviderClients = lazy(() => import('./pages/provider/Clients'));
const ProviderInvoicing = lazy(() => import('./pages/provider/Invoicing'));
const ProviderServices = lazy(() => import('./pages/provider/Services'));
const ProviderStaff = lazy(() => import('./pages/provider/Staff'));
const ProviderCommunications = lazy(() => import('./pages/provider/Communications'));
const NurseShift = lazy(() => import('./pages/provider/NurseShift'));
const NurseDashboard = lazy(() => import('./pages/provider/NurseDashboard'));
const ProviderReports = lazy(() => import('./pages/provider/Reports'));
const ProviderSettings = lazy(() => import('./pages/provider/Settings'));
const EventPage = lazy(() => import('./pages/EventPage'));

// Home stays eager — it's the landing page, it needs to be instant.
// Everything else is code-split so the initial bundle is just the marketing shell.
const OurStory = lazy(() => import('./pages/OurStory'));
const OurTeam = lazy(() => import('./pages/OurTeam'));
const Apply = lazy(() => import('./pages/Apply'));
const Careers = lazy(() => import('./pages/Careers'));
const FAQPage = lazy(() => import('./pages/FAQ'));
const DehydrationIV = lazy(() => import('./pages/products/DehydrationIV'));
const IVVitaminsService = lazy(() => import('./pages/services/IVVitamins'));
const NAD = lazy(() => import('./pages/services/NAD'));
const CBD = lazy(() => import('./pages/services/CBD'));
const IVVitaminsCategory = lazy(() => import('./pages/products/IVVitamins'));
const ProductDetail = lazy(() => import('./pages/products/ProductDetail'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const TelehealthDisclaimer = lazy(() => import('./pages/TelehealthDisclaimer'));
const ProductDisclaimer = lazy(() => import('./pages/ProductDisclaimer'));
const NoticeOfPrivacyPractices = lazy(() => import('./pages/NoticeOfPrivacyPractices'));
const Partners = lazy(() => import('./pages/Partners'));
const Platform = lazy(() => import('./pages/Platform'));
const B2B = lazy(() => import('./pages/B2B'));
const B2BThankYou = lazy(() => import('./pages/B2BThankYou'));
const CustomProtocol = lazy(() => import('./pages/CustomProtocol'));
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const Store = lazy(() => import('./pages/Store'));
const BookNow = lazy(() => import('./pages/BookNow'));
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'));
const Membership = lazy(() => import('./pages/Membership'));
const Corporate = lazy(() => import('./pages/Corporate'));
const EventsPage = lazy(() => import('./pages/Events'));
const Hotel = lazy(() => import('./pages/Hotel'));
const ServiceArea = lazy(() => import('./pages/ServiceArea'));
const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Safety = lazy(() => import('./pages/Safety'));
const Ingredients = lazy(() => import('./pages/Ingredients'));
const MedicalDirection = lazy(() => import('./pages/MedicalDirection'));
const Gift = lazy(() => import('./pages/Gift'));
const Athlete = lazy(() => import('./pages/Athlete'));
const Hangover = lazy(() => import('./pages/Hangover'));
const JetLag = lazy(() => import('./pages/JetLag'));
const Press = lazy(() => import('./pages/Press'));
const AdminCommand = lazy(() => import('./pages/admin/Command'));
const AdminInventory = lazy(() => import('./pages/admin/Inventory'));
const WaitlistPage = lazy(() => import('./pages/WaitlistPage'));

const HIDE_BOTTOM_NAV = ['/provider', '/admin', '/members', '/login', '/checkout'];

const BottomNavGate = () => {
  const { pathname } = useLocation();
  const hidden = HIDE_BOTTOM_NAV.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (hidden) {
      document.documentElement.classList.remove('has-bottom-nav');
    } else {
      document.documentElement.classList.add('has-bottom-nav');
    }
    return () => document.documentElement.classList.remove('has-bottom-nav');
  }, [hidden]);

  return hidden ? null : <BottomNav />;
};

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Section anchor — wait for lazy components to mount, then scroll into view
      const id = hash.slice(1);
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempts < 12) {
          attempts += 1;
          setTimeout(tryScroll, 80);
        }
      };
      tryScroll();
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
};

function AppRoutes() {
  return (
    <>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/our-story" element={<OurStory />} />
            <Route path="/team" element={<OurTeam />} />
            <Route path="/medical-direction" element={<MedicalDirection />} />
            <Route path="/our-team" element={<Navigate to="/team" replace />} />
            <Route path="/products/dehydration-iv" element={<DehydrationIV />} />
            <Route path="/services/iv-vitamins" element={<IVVitaminsService />} />
            <Route path="/services/nad" element={<NAD />} />
            <Route path="/services/cbd" element={<CBD />} />
            <Route path="/products/iv-vitamins" element={<IVVitaminsCategory />} />
            <Route path="/products/:category/:slug" element={<ProductDetail />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/events/:slug" element={<EventPage />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/corporate" element={<Corporate />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/hotel" element={<Hotel />} />
            <Route path="/service-area" element={<ServiceArea />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
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
            <Route path="/store" element={<Store />} />
            <Route path="/book" element={<BookNow />} />
            <Route path="/store/confirmation" element={<BookingConfirmation />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/login" element={<Login />} />
            <Route path="/members" element={<Navigate to="/login" replace />} />
            <Route path="/members/dashboard" element={<RequireAuth allowedRoles={['client', 'admin']}><MemberDashboard /></RequireAuth>} />
            <Route path="/provider" element={<Navigate to="/login" replace />} />
            <Route path="/provider/dashboard" element={<RequireAuth allowedRoles={['provider', 'admin']}><NurseDashboard /></RequireAuth>} />
            <Route path="/provider/appointments" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderAppointments /></RequireAuth>} />
            <Route path="/provider/clients" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderClients /></RequireAuth>} />
            <Route path="/provider/invoicing" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderInvoicing /></RequireAuth>} />
            <Route path="/provider/accounting" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderAccounting /></RequireAuth>} />
            <Route path="/provider/services" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderServices /></RequireAuth>} />
            <Route path="/provider/staff" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderStaff /></RequireAuth>} />
            <Route path="/provider/communications" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderCommunications /></RequireAuth>} />
            <Route path="/provider/shift" element={<RequireAuth allowedRoles={['provider', 'admin']}><NurseShift /></RequireAuth>} />
            <Route path="/provider/reports" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderReports /></RequireAuth>} />
            <Route path="/provider/settings" element={<RequireAuth allowedRoles={['provider', 'admin']}><ProviderSettings /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth allowedRoles={['admin']}><AdminCommand /></RequireAuth>} />
            <Route path="/admin/inventory" element={<RequireAuth allowedRoles={['admin']}><AdminInventory /></RequireAuth>} />
            <Route path="/admin/*" element={<RequireAuth allowedRoles={['admin']}><AdminCommand /></RequireAuth>} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/gift" element={<Gift />} />
            <Route path="/athlete" element={<Athlete />} />
            <Route path="/hangover" element={<Hangover />} />
            <Route path="/jet-lag" element={<JetLag />} />
            <Route path="/press" element={<Press />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/newsletter" element={<WaitlistPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthStoreProvider>
      <CartProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppLoader />
          <ScrollToTop />
          <ScrollProgress />
          <AppRoutes />
          <BottomNavGate />
        </Router>
        <Toaster />
        <CookieConsent />
      </CartProvider>
      </AuthStoreProvider>
    </ErrorBoundary>
  );
}

export default App;
