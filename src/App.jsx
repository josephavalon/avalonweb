import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import CookieConsent from '@/components/CookieConsent';
import ChatWidget from '@/components/ChatWidget';
import Home from './pages/Home';
import OurStory from './pages/OurStory';
import DehydrationIV from './pages/products/DehydrationIV';
import IVVitamins from './pages/services/IVVitamins';
import NAD from './pages/services/NAD';
import CBD from './pages/services/CBD';
import Exosomes from './pages/services/Exosomes';
import Apply from './pages/Apply';
import Careers from './pages/Careers';
import MembershipDashboard from './pages/MembershipDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import TelehealthDisclaimer from './pages/TelehealthDisclaimer';
import ProductDisclaimer from './pages/ProductDisclaimer';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-secondary border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/our-story" element={<OurStory />} />
      <Route path="/products/dehydration-iv" element={<DehydrationIV />} />
      <Route path="/services/iv-vitamins" element={<IVVitamins />} />
      <Route path="/services/nad" element={<NAD />} />
      <Route path="/services/cbd" element={<CBD />} />
      <Route path="/services/exosomes" element={<Exosomes />} />
      <Route path="/apply" element={<Apply />} />
      <Route path="/careers" element={<Careers />} />
      <Route path="/membership" element={<MembershipDashboard />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/telehealth-disclaimer" element={<TelehealthDisclaimer />} />
      <Route path="/product-disclaimer" element={<ProductDisclaimer />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <CookieConsent />
        <ChatWidget />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App