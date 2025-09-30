import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
    return null; // Will redirect to auth
  }

  return (
    <div className="relative">
      {/* Mobile-Friendly Logout Button */}
      <div className="absolute top-3 right-3 z-10">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={signOut}
          className="bg-background/80 backdrop-blur-sm text-xs sm:text-sm"
        >
          <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
          <span className="sm:hidden">Out</span>
        </Button>
      </div>
      
      <Dashboard />
    </div>
  );
};

export default Index;
