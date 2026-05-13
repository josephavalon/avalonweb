import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/lib/useAuthStore';

export default function ProtectedRoute({ allowedRoles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
    if (user.role === 'provider') return <Navigate to="/provider/shift" replace />;
    return <Navigate to="/members/dashboard" replace />;
  }
  return <Outlet />;
}
