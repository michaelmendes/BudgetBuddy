import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const isSetupRoute = location.pathname.startsWith('/setup');
  if (user && !user.setup_completed && !isSetupRoute) {
    return <Navigate to="/setup/categories" replace />;
  }
  if (user && user.setup_completed && isSetupRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
