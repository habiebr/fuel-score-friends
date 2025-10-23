import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { ChevronLeft, Target, Calendar, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeading } from '@/components/PageHeading';
import { getUserTimezone } from '@/lib/timezone';

export default function RaceGoal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Race Goal State
  const [raceGoal, setRaceGoal] = useState('');
  const [customGoalName, setCustomGoalName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadExistingGoals();
    }
  }, [user]);

  const loadExistingGoals = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('goal_type, goal_name, target_date, fitness_level')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading goals:', error);
        // Don't throw error, just continue with defaults
      } else if (data) {
        // Load existing goal data
        if (data.goal_type) {
          setRaceGoal(data.goal_type);
        } else if (data.fitness_goals && data.fitness_goals.length > 0) {
          const savedGoal = data.fitness_goals[0];
          const predefinedGoals = ['5k', '10k', 'half_marathon', 'full_marathon', 'ultra'];
          if (predefinedGoals.includes(savedGoal)) {
            setRaceGoal(savedGoal);
          } else {
            setRaceGoal('custom');
            setCustomGoalName(savedGoal);
          }
        }
        
        if (data.goal_name) setCustomGoalName(data.goal_name);
        if (data.target_date) setTargetDate(data.target_date);
        if (data.fitness_level) setFitnessLevel(data.fitness_level);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveGoals = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      // Validation
      if (!customGoalName.trim()) {
        throw new Error('Please enter a goal name');
      }
      if (!raceGoal) {
        throw new Error('Please select a race type');
      }
      if (!targetDate) {
        throw new Error('Please select a target date');
      }
      if (!fitnessLevel) {
        throw new Error('Please select your fitness level');
      }

      console.log('Goals to save:', {
        goalName: customGoalName,
        raceGoal,
        targetDate,
        fitnessLevel
      });

      const userTimezone = getUserTimezone();

      // Update profile with goal info
      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .upsert({
          user_id: user.id,
          fitness_goals: [customGoalName.trim()],
          goal_type: raceGoal || null,
          goal_name: customGoalName.trim() || null,
          target_date: targetDate || null,
          fitness_level: fitnessLevel || null,
          timezone: userTimezone
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error('Failed to save goals');
      }

      toast({
        title: 'Goals saved successfully!',
        description: 'Your running goals have been updated.',
      });

      // Navigate to training plan page
      navigate('/training-plan');

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save your goals',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isStepComplete = () => {
    return (raceGoal && (customGoalName.trim().length > 0) && targetDate && fitnessLevel);
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
              title="Set Your Race Goal"
              description="Tell us about your running goals and we'll help you achieve them."
              className="!mb-0 flex-1"
            />
          </div>

          {/* Progress Indicator */}
          <div className="mb-8 overflow-hidden">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-4">
              <div className="flex items-center space-x-2 text-primary">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-primary text-primary-foreground">
                  1
                </div>
                <span className="text-xs sm:text-sm font-medium">Running Goal</span>
              </div>
              <div className="w-8 h-0.5 bg-muted"></div>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-muted text-muted-foreground">
                  2
                </div>
                <span className="text-xs sm:text-sm font-medium">Training Plan</span>
              </div>
            </div>
          </div>

          {/* Race Goal Form */}
          <Card className="shadow-card mb-6 w-full max-w-full">
            <CardHeader className="w-full max-w-full box-border">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                What's Your Running Goal?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 w-full max-w-full box-border">
              {/* Race Type */}
              <div className="space-y-2">
                <Label htmlFor="race-type">What race are you targeting?</Label>
                <Select value={raceGoal} onValueChange={setRaceGoal}>
                  <SelectTrigger id="race-type">
                    <SelectValue placeholder="Pick a distance or custom event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5k">5K (5 km)</SelectItem>
                    <SelectItem value="10k">10K (10 km)</SelectItem>
                    <SelectItem value="half_marathon">Half Marathon (21.1 km)</SelectItem>
                    <SelectItem value="full_marathon">Full Marathon (42.2 km)</SelectItem>
                    <SelectItem value="ultra">Ultra Marathon (50+ km)</SelectItem>
                    <SelectItem value="custom">Custom Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Goal Name */}
              <div className="space-y-2">
                <Label htmlFor="goal-name">
                  {raceGoal === 'custom' ? 'Event Name' : 'Goal Name'}
                </Label>
                <Input
                  id="goal-name"
                  placeholder={
                    raceGoal === 'custom' 
                      ? 'e.g., Jakarta Marathon 2025' 
                      : raceGoal === '5k' 
                        ? 'e.g., My First 5K' 
                        : raceGoal === '10k'
                          ? 'e.g., 10K Personal Best'
                          : raceGoal === 'half_marathon'
                            ? 'e.g., Half Marathon Debut'
                            : raceGoal === 'full_marathon'
                              ? 'e.g., Marathon Dream'
                              : raceGoal === 'ultra'
                                ? 'e.g., Ultra Challenge'
                                : 'Enter your goal name'
                  }
                  value={customGoalName}
                  onChange={(e) => setCustomGoalName(e.target.value)}
                />
              </div>

              {/* Target Date */}
              <div className="space-y-2">
                <Label htmlFor="target-date">When is your target date?</Label>
                <Input
                  id="target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Fitness Level */}
              <div className="space-y-2">
                <Label htmlFor="fitness-level">What's your current fitness level?</Label>
                <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                  <SelectTrigger id="fitness-level">
                    <SelectValue placeholder="Select your fitness level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner - New to running</SelectItem>
                    <SelectItem value="intermediate">Intermediate - Regular runner</SelectItem>
                    <SelectItem value="advanced">Advanced - Experienced runner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={saveGoals}
                  disabled={!isStepComplete() || saving}
                  className="flex-1 sm:flex-none"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue to Training Plan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help Text */}
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Why do we need this information?
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Your race goal helps us create a personalized training plan with the right intensity, 
                    duration, and nutrition recommendations. We'll use this to build your weekly training 
                    schedule in the next step.
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

