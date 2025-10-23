import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { Target, Calendar, ArrowRight, CheckCircle, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeading } from '@/components/PageHeading';

export default function Goals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [raceGoalComplete, setRaceGoalComplete] = useState(false);
  const [trainingPlanComplete, setTrainingPlanComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkGoalStatus();
    }
  }, [user]);

  const checkGoalStatus = async () => {
    if (!user) return;

    try {
      // Check if race goal is set
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('goal_type, goal_name, target_date, fitness_level')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading profile:', profileError);
      } else if (profileData) {
        const hasRaceGoal = profileData.goal_type && profileData.goal_name && profileData.target_date && profileData.fitness_level;
        setRaceGoalComplete(!!hasRaceGoal);
      }

      // Check if training plan exists
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const start = weekStart.toISOString().split('T')[0];
      const end = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data: trainingData, error: trainingError } = await (supabase as any)
        .from('training_activities')
        .select('id')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end)
        .limit(1);

      if (trainingError) {
        console.error('Error loading training activities:', trainingError);
      } else {
        setTrainingPlanComplete((trainingData?.length || 0) > 0);
      }
    } catch (error) {
      console.error('Error checking goal status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-background flex items-center justify-center pb-20">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20 overflow-x-hidden w-screen">
        <div className="w-full px-4 py-4 box-border">
          {/* Header - Back button inline with title */}
          <div className="flex items-center gap-3 sm:gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="-ml-2 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <PageHeading
              title="Goals & Training"
              description="Set your race goals and create your training plan"
              className="!mb-0 flex-1"
            />
          </div>

          {/* Progress Overview */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-4">
              <div className={`flex items-center space-x-2 ${raceGoalComplete ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  raceGoalComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {raceGoalComplete ? <CheckCircle className="h-4 w-4" /> : '1'}
                </div>
                <span className="text-xs sm:text-sm font-medium">Running Goal</span>
              </div>
              <div className={`w-8 h-0.5 ${raceGoalComplete ? 'bg-primary' : 'bg-muted'}`}></div>
              <div className={`flex items-center space-x-2 ${trainingPlanComplete ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  trainingPlanComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {trainingPlanComplete ? <CheckCircle className="h-4 w-4" /> : '2'}
                </div>
                <span className="text-xs sm:text-sm font-medium">Training Plan</span>
              </div>
            </div>
          </div>

          {/* Step Cards */}
          <div className="space-y-6">
            {/* Step 1: Race Goal */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Step 1: Set Your Race Goal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Tell us about your running goals - what race are you targeting, when is it, and what's your current fitness level?
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => navigate('/race-goal')}
                    className="flex-1 sm:flex-none"
                    variant={raceGoalComplete ? "outline" : "default"}
                  >
                    {raceGoalComplete ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Update Race Goal
                      </>
                    ) : (
                      <>
                        Set Race Goal
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Training Plan */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Step 2: Create Your Training Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Map out your weekly training schedule. We'll use this to create personalized meal plans and nutrition recommendations.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => navigate('/training-plan')}
                    className="flex-1 sm:flex-none"
                    variant={trainingPlanComplete ? "outline" : "default"}
                    disabled={!raceGoalComplete}
                  >
                    {trainingPlanComplete ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Update Training Plan
                      </>
                    ) : (
                      <>
                        Create Training Plan
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
                
                {!raceGoalComplete && (
                  <p className="text-xs text-muted-foreground">
                    Complete Step 1 first to unlock the training plan editor.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Help Text */}
          <Card className="border-blue-200 dark:border-blue-800 mt-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Why do we need this information?
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Your race goal and training plan help us create personalized nutrition recommendations, 
                    meal plans, and recovery strategies tailored to your specific needs and timeline.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </>
  );
}