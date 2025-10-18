import { Suspense, lazy, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Lazy load heavy dialogs - these are not needed on initial page load
const FoodTrackerDialog = lazy(() => 
  import('@/components/FoodTrackerDialog').then(m => ({ default: m.FoodTrackerDialog }))
);
const FitnessScreenshotDialog = lazy(() => 
  import('@/components/FitnessScreenshotDialog').then(m => ({ default: m.FitnessScreenshotDialog }))
);


const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);

  // Check if user needs onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user || hasCheckedOnboarding) return;

      try {
        // Check if user has completed basic profile setup
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, age, height, weight')
          .eq('user_id', user.id)
          .maybeSingle();

        const hasBasicProfile = profile && profile.full_name && profile.age && profile.height && profile.weight;

        // Redirect to onboarding if basic profile is incomplete
        if (!hasBasicProfile) {
          navigate('/onboarding');
          return;
        }

        setHasCheckedOnboarding(true);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setHasCheckedOnboarding(true);
      }
    };

    checkOnboardingStatus();
  }, [user, navigate, hasCheckedOnboarding]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow"></div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <Dashboard 
          onAddMeal={() => setFoodTrackerOpen(true)} 
          onAnalyzeFitness={() => setFitnessScreenshotOpen(true)}
        />
      </div>
      <BottomNav />
      <ActionFAB
        onLogMeal={() => setFoodTrackerOpen(true)}
        onUploadActivity={() => setFitnessScreenshotOpen(true)}
      />
      
      {/* Lazy loaded dialogs with Suspense boundary */}
      <Suspense fallback={null}>
        {foodTrackerOpen && (
          <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
        )}
      </Suspense>
      
      <Suspense fallback={null}>
        {fitnessScreenshotOpen && (
          <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
        )}
      </Suspense>
    </>
  );
};

export default Index;
