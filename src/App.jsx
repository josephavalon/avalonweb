import { Toaster } from '@/components/ui/toaster';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import CookieConsent from '@/components/CookieConsent';
import ErrorBoundary from '@/components/ErrorBoundary';
import RouteFallback from '@/components/RouteFallback';
import Home from './pages/Home';
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
const CookiePolicy = lazy(() => import('./pages/CookiePolicy'));
const PageNotFound = lazy(() => import('./lib/PageNotFound'));

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
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            <Route path="/medical-direction" element={<Navigate to="/team" replace />} />
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
            {/* Presale phase: /membership redirects to /apply until member portal ships post-launch. */}
            <Route path="/membership" element={<Navigate to="/apply" replace />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="/telehealth-disclaimer" element={<TelehealthDisclaimer />} />
            <Route path="/product-disclaimer" element={<ProductDisclaimer />} />
            <Route path="/notice-of-privacy-practices" element={<NoticeOfPrivacyPractices />} />
            <Route path="/hipaa-notice" element={<NoticeOfPrivacyPractices />} />
            <Route path="/cookie-policy" element={<CookiePolicy />} />
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <AppRoutes />
      </Router>
      <Toaster />
      <CookieConsent />
    </ErrorBoundary>
  );
}

export default App;
