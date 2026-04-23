import React, { createContext, useContext } from 'react';

// Presale phase: auth is stubbed. The public marketing site doesn't gate on
// identity — all conversion routes through /apply. This provider exists only
// so legacy imports (App.jsx, ProtectedRoute) keep resolving until a real
// auth layer replaces it post-launch.
const AuthContext = createContext(null);

const noopAuthValue = {
  user: null,
  isAuthenticated: false,
  isLoadingAuth: false,
  isLoadingPublicSettings: false,
  authError: null,
  appPublicSettings: null,
  authChecked: true,
  logout: () => {},
  navigateToLogin: () => {},
  checkUserAuth: () => {},
  checkAppState: () => {},
};

export const AuthProvider = ({ children }) => (
  <AuthContext.Provider value={noopAuthValue}>
    {children}
  </AuthContext.Provider>
);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
