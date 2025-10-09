import { useAuth } from '@/hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles = [] }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Store the attempted URL for redirecting post-login
  if (!loading && !user) {
    try {
      localStorage.setItem('oauth_return_to', location.pathname + location.search);
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to auth page, but save the attempted URL
    return <Navigate to="/auth" replace />;
  }

  // If roles are specified, check if user has required role
  if (allowedRoles.length > 0) {
    const userRoles = user.app_metadata?.roles || [];
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
