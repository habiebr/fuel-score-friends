import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { AIMacroEstimation } from '@/components/AIMacroEstimation';
import { Target, Upload, Calendar, Zap, CheckCircle, Dumbbell, ArrowRight, ArrowLeft, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DayPlan {
  day: string;
  activity: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
  duration: number;
  distanceKm?: number;
  estimatedCalories: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Goals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Running Goal
  const [raceGoal, setRaceGoal] = useState('');
  const [customGoalName, setCustomGoalName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  
  // Step 2: Training Plan
  const [weekPlan, setWeekPlan] = useState<DayPlan[]>(
    DAYS.map((day) => ({
      day,
      activity: 'rest',
      duration: 0,
      estimatedCalories: 0,
    }))
  );
  
  // UI state
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadExistingGoals();
    }
  }, [user]);

  const formatGoalLabel = (value: string) => {
    if (!value) return '';
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const loadExistingGoals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('fitness_goals, activity_level, target_date, fitness_level, goal_type, goal_name')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading goals:', error);
        // Don't throw error, just continue with defaults
      } else if (data) {
        // Load Step 1 data
        if (data.goal_type) {
          setRaceGoal(data.goal_type);
        } else if (data.fitness_goals && data.fitness_goals.length > 0) {
          const savedGoal = data.fitness_goals[0];
          const predefinedGoals = ['5k', '10k', 'half_marathon', 'full_marathon', 'ultra'];
          setRaceGoal(predefinedGoals.includes(String(savedGoal).toLowerCase()) ? savedGoal : 'custom');
        }
        if (data.goal_name) {
          setCustomGoalName(data.goal_name);
        } else if (data.fitness_goals && data.fitness_goals.length > 0) {
          setCustomGoalName(formatGoalLabel(data.fitness_goals[0]));
        }
        if (data.target_date) {
          setTargetDate(data.target_date);
        }
        if (data.fitness_level) {
          setFitnessLevel(data.fitness_level);
        }
        
        // Load Step 2 data (training plan)
        if (data.activity_level && typeof data.activity_level === 'string' && data.activity_level.startsWith('[')) {
          try {
            const parsedPlan = JSON.parse(data.activity_level);
            if (Array.isArray(parsedPlan)) {
              setWeekPlan(parsedPlan);
            }
          } catch (e) {
            console.log('Could not parse training plan, using default');
          }
        }
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateCalories = (activity: string, duration: number, distanceKm?: number): number => {
    const caloriesPerMinute: { [key: string]: number } = {
      rest: 0,
      run: 10,
      strength: 6,
      cardio: 8,
      other: 7,
    };
    // For running, prefer distance-based rough estimate if distance is provided (≈ 60 kcal/km baseline)
    if (activity === 'run' && typeof distanceKm === 'number' && distanceKm > 0) {
      return Math.round(60 * distanceKm);
    }
    return Math.round((caloriesPerMinute[activity] || 0) * duration);
  };

  const updateDayPlan = (index: number, field: keyof DayPlan, value: any) => {
    setWeekPlan((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Ensure distanceKm is numeric when editing
      if (field === 'distanceKm') {
        updated[index].distanceKm = value === '' ? undefined : Number(value);
      }
      
      if (field === 'activity' || field === 'duration' || field === 'distanceKm') {
        const activity = field === 'activity' ? value : updated[index].activity;
        const duration = field === 'duration' ? Number(value) : updated[index].duration;
        const distanceKm = field === 'distanceKm' ? (value === '' ? undefined : Number(value)) : updated[index].distanceKm;
        updated[index].estimatedCalories = calculateCalories(activity, duration, distanceKm);
      }
      
      return updated;
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setParsing(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64Image = reader.result as string;
        const session = (await supabase.auth.getSession()).data.session;
        const apiKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
        const { data, error } = await supabase.functions.invoke('parse-training-plan', {
          body: { image: base64Image },
          headers: {
            ...(apiKey ? { apikey: apiKey } : {}),
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          }
        });

        if (error) throw error;

        toast({
          title: "Training plan parsed!",
          description: data.message || "Your training schedule has been imported",
        });

        // Trigger regeneration for affected dates (next 7 weeks)
        try {
          const today = new Date().toISOString().split('T')[0];
          const session = (await supabase.auth.getSession()).data.session;
          const apiKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
          await supabase.functions.invoke('generate-meal-plan-range', {
            body: { startDate: today, weeks: 7 },
            headers: {
              ...(apiKey ? { apikey: apiKey } : {}),
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            }
          });
        } catch (regenErr) {
          console.error('Failed to refresh daily_meal_plans:', regenErr);
        }
      };
    } catch (error) {
      console.error('Error parsing training plan:', error);
      toast({
        title: "Parsing failed",
        description: "Failed to parse training plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
      event.target.value = '';
    }
  };

  const handleSaveGoals = async () => {
    if (!user) return;

    setUploading(true);
    try {
      // Prepare payload for upsert (insert or update by user_id)
      const updateData: any = {
        user_id: user.id,
        // Preserve historical fitness_goals array but prioritize new fields
        fitness_goals: [customGoalName.trim()],
        goal_type: raceGoal || null,
        goal_name: customGoalName.trim() || null,
        activity_level: JSON.stringify(weekPlan)
      };

      // Only add these fields if they have values (in case columns don't exist yet)
      if (targetDate) {
        updateData.target_date = targetDate;
      }
      if (fitnessLevel) {
        updateData.fitness_level = fitnessLevel;
      }

      // Upsert so brand-new users get a row created
      let { error } = await supabase
        .from('profiles')
        .upsert(updateData, { onConflict: 'user_id' });

      // If the new columns don't exist yet, retry without them
      if (error && (String(error.message).includes('goal_name') || String(error.message).includes('goal_type') || String((error as any).code) === '42703')) {
        const fallbackData: any = {
          user_id: user.id,
          fitness_goals: [customGoalName.trim()],
          activity_level: JSON.stringify(weekPlan)
        };
        if (targetDate) fallbackData.target_date = targetDate;
        if (fitnessLevel) fallbackData.fitness_level = fitnessLevel;

        const retry = await supabase
          .from('profiles')
          .upsert(fallbackData, { onConflict: 'user_id' });
        error = retry.error;
      }

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Database update failed');
      }

      toast({
        title: "Goals & Plan saved!",
        description: "Your running goal and training plan have been updated",
      });

      // Regenerate meal plans for the next 7 weeks so Dashboard shows updated data
      try {
        const today = new Date().toISOString().split('T')[0];
        const session = (await supabase.auth.getSession()).data.session;
        const apiKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
        await supabase.functions.invoke('generate-meal-plan-range', {
          body: { startDate: today, weeks: 7 },
          headers: {
            ...(apiKey ? { apikey: apiKey } : {}),
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          }
        });
      } catch (regenErr) {
        console.error('Failed to refresh daily_meal_plans after save:', regenErr);
      }
    } catch (error) {
      console.error('Error saving goals:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Save failed",
        description: `Failed to save goals and plan: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const canProceedToStep2 = () => {
    return (raceGoal && (customGoalName.trim().length > 0) && targetDate && fitnessLevel);
  };

  const isStep1Complete = () => {
    return (raceGoal && (customGoalName.trim().length > 0) && targetDate && fitnessLevel);
  };

  const isStep2Complete = () => {
    return weekPlan.some(day => day.activity !== 'rest' && day.duration > 0);
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
        <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      </>
    );
  }

  return (
    <>
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Set Your Goals & Training Plan
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Define your running goal and create your weekly training schedule
            </p>
          </div>


          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4">
              <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  1
                </div>
                <span className="text-sm font-medium">Running Goal</span>
              </div>
              <div className={`w-8 h-0.5 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
              <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  2
                </div>
                <span className="text-sm font-medium">Training Plan</span>
              </div>
            </div>
          </div>

          {/* Step 1: Running Goal */}
          {currentStep === 1 && (
            <Card className="shadow-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Step 1: What's Your Running Goal?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Race Type */}
                <div className="space-y-2">
                  <Label htmlFor="race-type">Race Distance or Event</Label>
                  <Select value={raceGoal} onValueChange={setRaceGoal}>
                    <SelectTrigger id="race-type">
                      <SelectValue placeholder="Select your target race distance or event" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5k">5K (3.1 miles)</SelectItem>
                      <SelectItem value="10k">10K (6.2 miles)</SelectItem>
                      <SelectItem value="half_marathon">Half Marathon (13.1 miles)</SelectItem>
                      <SelectItem value="full_marathon">Full Marathon (26.2 miles)</SelectItem>
                      <SelectItem value="ultra">Ultra Marathon (50K+)</SelectItem>
                      <SelectItem value="custom">Custom Race/Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Race/Event Name - always shown for consistency */}
                <div className="space-y-2">
                  <Label htmlFor="custom-goal-name">Race/Event Name *</Label>
                  <Input
                    id="custom-goal-name"
                    type="text"
                    placeholder="e.g., Jakarta Marathon 2025, Personal Best 5K, Trail Run Challenge, etc."
                    value={customGoalName}
                    onChange={(e) => setCustomGoalName(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    A readable name for your specific race or running event
                  </p>
                </div>

                {/* Target Date */}
                <div className="space-y-2">
                  <Label htmlFor="target-date">Target Race Date</Label>
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
                  <Label htmlFor="fitness-level">Current Fitness Level</Label>
                  <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                    <SelectTrigger id="fitness-level">
                      <SelectValue placeholder="Select your current fitness level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner (0-6 months running)</SelectItem>
                      <SelectItem value="intermediate">Intermediate (6 months - 2 years)</SelectItem>
                      <SelectItem value="advanced">Advanced (2+ years running)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Marathon Calendar Link */}
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/marathons')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Browse Specific Races
                  </Button>
                </div>

                {/* Step Navigation */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!canProceedToStep2()}
                    className="flex items-center gap-2"
                  >
                    Next: Training Plan
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Training Plan */}
          {currentStep === 2 && (
            <Card className="shadow-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  Step 2: Create Your Weekly Training Plan
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Plan your weekly training schedule. Set rest days and workout activities.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Weekly Summary */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {weekPlan.filter(day => day.activity !== 'rest').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Days</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {weekPlan.reduce((sum, day) => sum + day.estimatedCalories, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Weekly Calories</div>
                  </div>
                </div>

                {/* Day Plans */}
                <div className="space-y-4">
                  {weekPlan.map((dayPlan, index) => (
                    <div
                      key={dayPlan.day}
                      className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {dayPlan.activity === 'rest' ? (
                          <Pause className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Play className="h-4 w-4 text-primary" />
                        )}
                        <div className="font-semibold text-sm flex-1">{dayPlan.day}</div>
                        {dayPlan.estimatedCalories > 0 && (
                          <div className="text-xs text-primary font-medium">
                            ~{dayPlan.estimatedCalories} cal
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Activity</Label>
                          <Select
                            value={dayPlan.activity}
                            onValueChange={(value) => updateDayPlan(index, 'activity', value)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rest">Rest Day</SelectItem>
                              <SelectItem value="run">Running</SelectItem>
                              <SelectItem value="strength">Strength Training</SelectItem>
                              <SelectItem value="cardio">Cardio</SelectItem>
                              <SelectItem value="other">Other Exercise</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {dayPlan.activity !== 'rest' && dayPlan.activity !== 'run' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Duration (minutes)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="300"
                              value={dayPlan.duration || ''}
                              onChange={(e) => updateDayPlan(index, 'duration', e.target.value)}
                              placeholder="0"
                              className="h-9"
                            />
                          </div>
                        )}
                        {dayPlan.activity === 'run' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Distance (km)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={typeof dayPlan.distanceKm === 'number' ? dayPlan.distanceKm : ''}
                              onChange={(e) => updateDayPlan(index, 'distanceKm', e.target.value)}
                              placeholder="0.0"
                              className="h-9"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Step Navigation */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Goal
                  </Button>
                  <Button
                    onClick={handleSaveGoals}
                    disabled={uploading || !isStep1Complete()}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Save Goals & Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nutrition Insights - Show on both steps */}
          <AIMacroEstimation />
        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
