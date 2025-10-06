import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard';
import { BottomNav } from '@/components/BottomNav';
import { OnboardingDialog } from '@/components/OnboardingDialog';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { ActionFAB } from '@/components/ActionFAB';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (!loading && !user) {
        navigate('/auth');
      } else if (!loading && user) {
        // Check if user has seen onboarding
        const { data } = await supabase
          .from('user_preferences')
          .select('value')
          .eq('user_id', user.id)
          .eq('key', 'onboarding')
          .maybeSingle();
        
        if (!data?.value?.hasSeenOnboarding) {
          setShowOnboarding(true);
        }
      }
    };
    
    checkOnboarding();
  }, [user, loading, navigate]);

  const handleOnboardingComplete = async () => {
    await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        key: 'onboarding',
        value: { hasSeenOnboarding: true },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,key'
      });
    setShowOnboarding(false);
  };

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
    <>
      <OnboardingDialog open={showOnboarding} onComplete={handleOnboardingComplete} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
        <Dashboard 
          onAddMeal={() => setFoodTrackerOpen(true)} 
          onAnalyzeFitness={() => setFitnessScreenshotOpen(true)}
        />
        </div>
      </div>
      <BottomNav />
      <ActionFAB
        onLogMeal={() => setFoodTrackerOpen(true)}
        onUploadActivity={() => setFitnessScreenshotOpen(true)}
      />
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
    </>
  );
};

export default Index;
