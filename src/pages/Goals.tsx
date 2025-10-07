import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Target, Upload, Calendar, Zap, CheckCircle, Dumbbell, ArrowRight, ArrowLeft, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TrainingActivity {
  id?: string;
  date: string;
  activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
  start_time?: string;
  duration_minutes: number;
  distance_km?: number;
  intensity: 'low' | 'moderate' | 'high';
  estimated_calories: number;
  notes?: string;
}

interface DayPlan {
  day: string;
  activities: TrainingActivity[];
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
      activities: []
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

  const calculateCalories = (activity: TrainingActivity): number => {
    const caloriesPerMinute: { [key: string]: number } = {
      rest: 0,
      run: 10,
      strength: 6,
      cardio: 8,
      other: 7,
    };

    const intensityMultiplier = {
      low: 0.8,
      moderate: 1.0,
      high: 1.2
    };

    // For running, prefer distance-based rough estimate if distance is provided (≈ 60 kcal/km baseline)
    if (activity.activity_type === 'run' && typeof activity.distance_km === 'number' && activity.distance_km > 0) {
      return Math.round(60 * activity.distance_km * intensityMultiplier[activity.intensity]);
    }

    return Math.round(
      (caloriesPerMinute[activity.activity_type] || 0) * 
      activity.duration_minutes * 
      intensityMultiplier[activity.intensity]
    );
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
        const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
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
          const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
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
      // Start a transaction
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      // 1. Update profile with goal info
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: user.id,
          fitness_goals: [customGoalName.trim()],
          goal_type: raceGoal || null,
          goal_name: customGoalName.trim() || null,
          target_date: targetDate || null,
          fitness_level: fitnessLevel || null
        }, {
          onConflict: 'user_id'
        });

      if (profileError) throw profileError;

      // 2. Delete existing training activities for the next 7 days
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      const endDateStr = endDate.toISOString().split('T')[0];

      const { error: deleteError } = await supabase
        .from('training_activities')
        .delete()
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDateStr);

      if (deleteError) throw deleteError;

      // 3. Insert new training activities
      const activities = weekPlan.flatMap((day, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index);
        const dateStr = date.toISOString().split('T')[0];

        return day.activities.map(activity => ({
          user_id: user.id,
          date: dateStr,
          activity_type: activity.activity_type,
          start_time: activity.start_time,
          duration_minutes: activity.duration_minutes,
          distance_km: activity.distance_km,
          intensity: activity.intensity,
          estimated_calories: activity.estimated_calories,
          notes: activity.notes
        }));
      });

      if (activities.length > 0) {
        const { error: insertError } = await supabase
          .from('training_activities')
          .insert(activities);

        if (insertError) throw insertError;
      }

      // 4. Regenerate meal plans
      const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      await supabase.functions.invoke('generate-meal-plan-range', {
        body: { startDate, weeks: 7 },
        headers: {
          ...(apiKey ? { apikey: apiKey } : {}),
          Authorization: `Bearer ${session.access_token}`
        }
      });

      toast({
        title: "Goals & Plan saved!",
        description: "Your running goal and training plan have been updated",
      });

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
                      {weekPlan.reduce((sum, day) => sum + day.activities.length, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Activities</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {weekPlan.reduce((sum, day) => 
                        sum + day.activities.reduce((daySum, activity) => 
                          daySum + activity.estimated_calories, 0), 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Weekly Calories</div>
                  </div>
                </div>

                {/* Day Plans */}
                <div className="space-y-4">
                  {weekPlan.map((dayPlan, dayIndex) => (
                    <div
                      key={dayPlan.day}
                      className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {dayPlan.activities.length === 0 ? (
                          <Pause className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Play className="h-4 w-4 text-primary" />
                        )}
                        <div className="font-semibold text-sm flex-1">{dayPlan.day}</div>
                        {dayPlan.activities.length > 0 && (
                          <div className="text-xs text-primary font-medium">
                            ~{dayPlan.activities.reduce((sum, activity) => sum + activity.estimated_calories, 0)} cal
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + dayIndex);
                            addActivity(dayIndex, {
                              date: date.toISOString().split('T')[0],
                              activity_type: 'run',
                              duration_minutes: 30,
                              intensity: 'moderate',
                              estimated_calories: 300
                            });
                          }}
                          className="h-8 px-2"
                        >
                          + Add Activity
                        </Button>
                      </div>

                      {dayPlan.activities.map((activity, activityIndex) => (
                        <div key={activityIndex} className="mb-4 last:mb-0 p-3 bg-muted/50 rounded-lg">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Activity</Label>
                              <Select
                                value={activity.activity_type}
                                onValueChange={(value: any) => updateActivity(dayIndex, activityIndex, {
                                  activity_type: value,
                                  duration_minutes: activity.duration_minutes,
                                  distance_km: undefined,
                                  estimated_calories: calculateCalories({
                                    ...activity,
                                    activity_type: value,
                                    distance_km: undefined
                                  })
                                })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="run">Running</SelectItem>
                                  <SelectItem value="strength">Strength Training</SelectItem>
                                  <SelectItem value="cardio">Cardio</SelectItem>
                                  <SelectItem value="other">Other Exercise</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Intensity</Label>
                              <Select
                                value={activity.intensity}
                                onValueChange={(value: any) => updateActivity(dayIndex, activityIndex, {
                                  ...activity,
                                  intensity: value,
                                  estimated_calories: calculateCalories({
                                    ...activity,
                                    intensity: value
                                  })
                                })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="moderate">Moderate</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {activity.activity_type !== 'run' && (
                              <div className="space-y-1">
                                <Label className="text-xs">Duration (minutes)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={activity.duration_minutes || ''}
                                  onChange={(e) => updateActivity(dayIndex, activityIndex, {
                                    ...activity,
                                    duration_minutes: parseInt(e.target.value) || 0,
                                    estimated_calories: calculateCalories({
                                      ...activity,
                                      duration_minutes: parseInt(e.target.value) || 0
                                    })
                                  })}
                                  placeholder="0"
                                  className="h-9"
                                />
                              </div>
                            )}
                            {activity.activity_type === 'run' && (
                              <div className="space-y-1">
                                <Label className="text-xs">Distance (km)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={typeof activity.distance_km === 'number' ? activity.distance_km : ''}
                                  onChange={(e) => updateActivity(dayIndex, activityIndex, {
                                    ...activity,
                                    distance_km: parseFloat(e.target.value) || undefined,
                                    estimated_calories: calculateCalories({
                                      ...activity,
                                      distance_km: parseFloat(e.target.value) || undefined
                                    })
                                  })}
                                  placeholder="0.0"
                                  className="h-9"
                                />
                              </div>
                            )}
                            <div className="flex items-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeActivity(dayIndex, activityIndex)}
                                className="h-9 px-2 text-destructive hover:text-destructive"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
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

        </div>
      </div>
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
