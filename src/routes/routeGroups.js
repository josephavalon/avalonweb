export const publicRoutes = [
  '/',
  '/our-story',
  '/team',
  '/medical-direction',
  '/careers',
  '/faq',
  '/corporate',
  '/events',
  '/hotel',
  '/service-area',
  '/partners',
  '/platform',
  '/b2b',
  '/safety',
  '/ingredients',
  '/gift',
  '/athlete',
  '/hangover',
  '/jet-lag',
  '/press',
  '/pricing',
];

export const shopRoutes = [
  '/menu',
  '/store',
  '/book',
  '/checkout',
  '/checkout/success',
  '/store/confirmation',
  '/subscription',
  '/subscribe',
  '/custom',
  '/products/:category/:slug',
  '/therapies/:slug',
];

export const legalRoutes = [
  '/privacy-policy',
  '/terms-and-conditions',
  '/terms-of-service',
  '/telehealth-disclaimer',
  '/product-disclaimer',
  '/notice-of-privacy-practices',
  '/hipaa-notice',
  '/cookie-policy',
  '/cookies',
];

export const appRoutes = [
  '/login',
  '/members',
  '/members/dashboard',
  '/provider',
  '/provider/dashboard',
  '/provider/appointments',
  '/provider/clients',
  '/provider/invoicing',
  '/provider/accounting',
  '/provider/services',
  '/provider/staff',
  '/provider/communications',
  '/provider/shift',
  '/provider/reports',
  '/provider/settings',
  '/admin',
  '/admin/inventory',
  '/admin/bookings',
  '/admin/*',
];

export const routeGroups = {
  public: publicRoutes,
  shop: shopRoutes,
  legal: legalRoutes,
  app: appRoutes,
};

export const allKnownRoutes = Object.values(routeGroups).flat();
