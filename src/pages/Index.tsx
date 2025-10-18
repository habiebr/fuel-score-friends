import { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { useAuth } from '@/hooks/useAuth';

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
