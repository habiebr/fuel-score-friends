import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('AuthCallback: Handling OAuth callback...');
        
        // Get the session from the URL hash/fragment
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthCallback: Session error:', error);
          setError(error.message);
          return;
        }

        if (data.session) {
          console.log('AuthCallback: Session restored successfully:', data.session.user.id);
          
          // Get the return URL from localStorage
          const returnTo = localStorage.getItem('oauth_return_to') || '/';
          localStorage.removeItem('oauth_return_to');
          
          console.log('AuthCallback: Redirecting to:', returnTo);
          navigate(returnTo, { replace: true });
        } else {
          console.log('AuthCallback: No session found, redirecting to auth');
          navigate('/auth', { replace: true });
        }
      } catch (err) {
        console.error('AuthCallback: Unexpected error:', err);
        setError('An unexpected error occurred during authentication');
      }
    };

    // Small delay to ensure auth state is updated
    const timer = setTimeout(handleAuthCallback, 100);
    return () => clearTimeout(timer);
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow mx-auto mb-4"></div>
          </div>
          <p className="text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => navigate('/auth')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-white text-xl">✓</span>
          </div>
          <h2 className="text-xl font-semibold mb-2">Authentication Successful</h2>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow mx-auto mb-4"></div>
        </div>
        <p className="text-muted-foreground">Processing authentication...</p>
      </div>
    </div>
  );
}
