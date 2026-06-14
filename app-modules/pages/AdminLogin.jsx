import React from 'react';
import Login from './Login.jsx';

// Operations sign-in is the same unified login surface, opened with the admin
// audience preselected. Role enforcement, no-index SEO, and the operator-ID
// demo form all live in Login.jsx.
export default function AdminLogin() {
  return <Login defaultAudience="admin" />;
}
