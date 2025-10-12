import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Target, Upload, Calendar, Zap, CheckCircle, Dumbbell, ArrowRight, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addDays, format, startOfWeek } from 'date-fns';
import { PageHeading } from '@/components/PageHeading';
import { getUserTimezone, getLocalDateString } from '@/lib/timezone';

type ActivityType = 'rest' | 'run' | 'strength' | 'cardio' | 'other';
type Intensity = 'low' | 'moderate' | 'high';
type UiActivityType = 'run' | 'long_run' | 'interval' | 'strength' | 'rest';

interface TrainingActivity {
  id?: string;
  date: string; // yyyy-MM-dd
  activity_type: ActivityType;
  start_time?: string | null; // HH:mm
  duration_minutes: number; // for non-run
  distance_km?: number | null; // for run
  intensity: Intensity;
  estimated_calories: number;
  notes?: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const getUiActivityLabel = (type: UiActivityType) => {
  switch (type) {
    case 'long_run':
      return 'Long Run';
    case 'interval':
      return 'Interval Session';
    case 'strength':
      return 'Strength Training';
    case 'rest':
      return 'Rest Day';
    default:
      return 'Run';
  }
};

const formatIntensity = (intensity?: Intensity) => {
  if (!intensity) return '';
  return intensity.charAt(0).toUpperCase() + intensity.slice(1);
};

const deriveUiActivityType = (activity: TrainingActivity): UiActivityType => {
  if (activity.activity_type === 'rest') return 'rest';
  if (activity.activity_type === 'strength') return 'strength';
  if (activity.activity_type === 'run') {
    if ((activity.distance_km ?? 0) >= 15) return 'long_run';
    if (activity.intensity === 'high') return 'interval';
    return 'run';
  }
  return 'run';
};

const applyUiActivityType = (uiType: UiActivityType, activity: TrainingActivity): TrainingActivity => {
  const next = { ...activity };
  switch (uiType) {
    case 'rest':
      next.activity_type = 'rest';
      next.distance_km = null;
      next.duration_minutes = 0;
      next.intensity = 'low';
      break;
    case 'strength':
      next.activity_type = 'strength';
      next.distance_km = null;
      next.duration_minutes = next.duration_minutes || 45;
      if (next.intensity === 'low') next.intensity = 'moderate';
      break;
    case 'long_run':
      next.activity_type = 'run';
      next.distance_km = Math.max(15, next.distance_km ?? 16);
      next.duration_minutes = Math.max(90, next.duration_minutes || 90);
      if (next.intensity === 'high') next.intensity = 'moderate';
      break;
    case 'interval':
      next.activity_type = 'run';
      next.distance_km = Math.max(5, next.distance_km ?? 6);
      next.duration_minutes = Math.max(45, next.duration_minutes || 45);
      next.intensity = 'high';
      break;
    case 'run':
    default:
      next.activity_type = 'run';
      next.distance_km = Math.max(4, next.distance_km ?? 5);
      next.duration_minutes = Math.max(30, next.duration_minutes || 40);
      if (next.intensity === 'high') next.intensity = 'moderate';
      break;
  }
  if (uiType !== 'rest' && next.duration_minutes === 0) {
    next.duration_minutes = 40;
  }
  return next;
};

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
  
  // Step 2: Training Plan (inline editor using training_activities) - One week only
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const datesOfWeek = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [activitiesByDate, setActivitiesByDate] = useState<Record<string, TrainingActivity[]>>({});
  const [expandedEditor, setExpandedEditor] = useState<{ date: string; index: number } | null>(null);
  
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

  // Reload data when week changes
  useEffect(() => {
    if (user) {
      loadExistingGoals();
    }
  }, [weekStart, user, datesOfWeek]);

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
        
        // Load Step 2 data from training_activities for current week
        try {
          const start = format(weekStart, 'yyyy-MM-dd');
          const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
          const { data: acts, error: actErr } = await (supabase as any)
            .from('training_activities')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', start)
            .lte('date', end)
            .order('date', { ascending: true });
          if (actErr) throw actErr;
          const grouped: Record<string, TrainingActivity[]> = {};
          for (const d of datesOfWeek) grouped[format(d, 'yyyy-MM-dd')] = [];
          (acts || []).forEach((row: any) => {
            const key = row.date;
            const act: TrainingActivity = {
              id: row.id,
              date: row.date,
              activity_type: row.activity_type,
              start_time: row.start_time,
              duration_minutes: row.duration_minutes,
              distance_km: row.distance_km,
              intensity: row.intensity,
              estimated_calories: row.estimated_calories,
              notes: row.notes,
            };
            // Always add to the grouped object, even if the key wasn't initialized
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(act);
          });
          setActivitiesByDate(grouped);
        } catch (e) {
          console.error('Failed to load training activities for summary', e);
          setActivitiesByDate({});
        }
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const weeklyCalories = useMemo(() => {
    return datesOfWeek.reduce((sum, d) => {
      const key = format(d, 'yyyy-MM-dd');
      return sum + (activitiesByDate[key] || []).reduce((s, a) => s + a.estimated_calories, 0);
    }, 0);
  }, [activitiesByDate, datesOfWeek]);

  const calculateCalories = (activity: TrainingActivity): number => {
    const caloriesPerMinute: Record<ActivityType, number> = {
      rest: 0,
      run: 10,
      strength: 6,
      cardio: 8,
      other: 7,
    };
    const mult: Record<Intensity, number> = { low: 0.8, moderate: 1.0, high: 1.2 };
    if (activity.activity_type === 'run' && activity.distance_km && activity.distance_km > 0) {
      return Math.round(60 * activity.distance_km * mult[activity.intensity]);
    }
    return Math.round((caloriesPerMinute[activity.activity_type] || 0) * activity.duration_minutes * mult[activity.intensity]);
  };

  const addActivity = (dateStr: string) => {
    setActivitiesByDate((prev) => {
      const next = { ...prev };
      const base: TrainingActivity = {
        date: dateStr,
        activity_type: 'run',
        duration_minutes: 40,
        distance_km: 5,
        intensity: 'moderate',
        start_time: null,
        estimated_calories: 300,
        notes: null,
      };
      base.estimated_calories = calculateCalories(base);
      next[dateStr] = [...(next[dateStr] || []), base];
      
      // Set the editor to the newly added activity
      const newIndex = (next[dateStr]?.length || 1) - 1;
      setExpandedEditor({ date: dateStr, index: newIndex });
      
      console.log('Added activity:', base, 'at index:', newIndex);
      return next;
    });
  };

  const updateActivity = (
    dateStr: string,
    index: number,
    patch: Partial<TrainingActivity> | ((activity: TrainingActivity) => TrainingActivity)
  ) => {
    setActivitiesByDate((prev) => {
      const next = { ...prev };
      const list = [...(next[dateStr] || [])];
      const current = list[index];
      if (!current) {
        console.error('Activity not found at index', index, 'for date', dateStr);
        return next;
      }
      
      const updated =
        typeof patch === 'function'
          ? patch(current)
          : ({ ...current, ...patch } as TrainingActivity);
      
      // Recalculate calories after update
      updated.estimated_calories = calculateCalories(updated);
      
      // Update the activity in the list
      list[index] = updated;
      next[dateStr] = list;
      
      console.log('Updated activity:', updated);
      return next;
    });
  };

  const removeActivity = (dateStr: string, index: number) => {
    setActivitiesByDate((prev) => {
      const next = { ...prev };
      next[dateStr] = (next[dateStr] || []).filter((_, i) => i !== index);
      
      // Close editor if we're removing the currently edited activity
      if (expandedEditor && expandedEditor.date === dateStr && expandedEditor.index === index) {
        setExpandedEditor(null);
      }
      
      console.log('Removed activity at index:', index, 'for date:', dateStr);
      return next;
    });
  };

  const handleEditActivity = (dateStr: string, index: number) => {
    console.log('Edit button clicked for date:', dateStr, 'index:', index);
    console.log('Current activities for date:', activitiesByDate[dateStr]);
    console.log('Activity at index:', activitiesByDate[dateStr]?.[index]);
    
    setExpandedEditor({ date: dateStr, index });
  };

  const upsertActivity = async (dateStr: string, index: number) => {
    if (!user) return;
    const act = (activitiesByDate[dateStr] || [])[index];
    if (!act) return;
    try {
      const payload: any = {
        user_id: user.id,
        date: dateStr,
        activity_type: act.activity_type,
        start_time: act.start_time,
        duration_minutes: act.duration_minutes,
        distance_km: act.distance_km,
        intensity: act.intensity,
        estimated_calories: act.estimated_calories,
        notes: act.notes,
      };
      if (act.id) payload.id = act.id;
      const { data, error } = await (supabase as any).from('training_activities').upsert(payload).select().single();
      if (error) throw error;
      // update local state with id if newly created
      setActivitiesByDate((prev) => {
        const next = { ...prev };
        const list = [...(next[dateStr] || [])];
        list[index] = { ...act, id: data.id } as any;
        next[dateStr] = list;
        return next;
      });
    } catch (e) {
      console.error('Auto-save failed', e);
    }
  };

  const handleCloseEditor = () => {
    if (expandedEditor) {
      upsertActivity(expandedEditor.date, expandedEditor.index);
    }
    setExpandedEditor(null);
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
          await supabase.functions.invoke('generate-nutrition-suggestions', {
            body: { date: today },
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
    if (!user) {
      toast({
        title: "Not logged in",
        description: "Please log in to save your goals",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      console.log('Starting handleSaveGoals...');
      
      // Start a transaction
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session found');
      }
      
      console.log('Session found:', session.user?.id);
      
      // Validate required fields
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
      
      console.log('Validation passed, proceeding with save...');
      console.log('Goals to save:', {
        goalName: customGoalName,
        raceGoal,
        targetDate,
        fitnessLevel
      });

      // 1. Update profile with goal info
      console.log('Preparing profile update...');
      
      // Prepare weekly pattern data first to catch any potential JSON issues
      const weeklyPattern = DAYS.map((day, idx) => {
        const currentDate = datesOfWeek[idx];
        const key = format(currentDate, 'yyyy-MM-dd');
        const acts = activitiesByDate[key] || [];
        
        return {
          day,
          activities: acts.map(act => ({
            activity_type: act.activity_type,
            duration_minutes: Math.max(0, parseInt(String(act.duration_minutes)) || 0),
            distance_km: act.distance_km ? parseFloat(String(act.distance_km)) || null : null,
            intensity: act.intensity,
            estimated_calories: Math.max(0, parseInt(String(act.estimated_calories)) || 0)
          }))
        };
      });

      console.log('Weekly pattern prepared:', weeklyPattern);
      
      const profileData = {
        user_id: user.id,
        fitness_goals: [customGoalName.trim()],
        goal_type: raceGoal || null,
        goal_name: customGoalName.trim() || null,
        target_date: targetDate || null,
        fitness_level: fitnessLevel || null,
        activity_level: JSON.stringify(weeklyPattern)
      };

      console.log('Profile data to save:', profileData);

      const { data: savedProfile, error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('Profile update failed:', profileError);
        throw new Error(`Profile update failed: ${profileError.message}`);
      }

      console.log('Profile updated successfully:', savedProfile);

      // 2. Persist the current week's training plan
      const startDateObj = datesOfWeek[0];
      const endDateObj = addDays(weekStart, 6);

      console.log('Starting training activities update...');
      
      // Delete existing activities for this week only
      const deleteStartDate = format(startDateObj, 'yyyy-MM-dd');
      const deleteEndDate = format(endDateObj, 'yyyy-MM-dd');
      
      console.log('Deleting activities for date range:', {
        start: deleteStartDate,
        end: deleteEndDate
      });

      const { error: delErr } = await (supabase as any)
        .from('training_activities')
        .delete()
        .eq('user_id', user.id)
        .gte('date', deleteStartDate)
        .lte('date', deleteEndDate);

      if (delErr) {
        console.error('Failed to delete existing activities:', delErr);
        throw new Error(`Failed to delete existing activities: ${delErr.message}`);
      }

      console.log('Successfully deleted existing activities');

      // Prepare new activities
      const rows: any[] = [];
      datesOfWeek.forEach((date) => {
        const key = format(date, 'yyyy-MM-dd');
        const acts = activitiesByDate[key] || [];
        acts.forEach((act) => {
          rows.push({
            user_id: user.id,
            date: key,
            activity_type: act.activity_type,
            start_time: act.start_time,
            duration_minutes: Math.max(0, parseInt(String(act.duration_minutes)) || 0),
            distance_km: act.distance_km ? parseFloat(String(act.distance_km)) || null : null,
            intensity: act.intensity,
            estimated_calories: Math.max(0, parseInt(String(act.estimated_calories)) || 0),
            notes: act.notes,
          });
        });
      });

      console.log('Prepared activities to insert:', rows);

      if (rows.length > 0) {
        const { data: insertedRows, error: insErr } = await (supabase as any)
          .from('training_activities')
          .insert(rows)
          .select();

        if (insErr) {
          console.error('Failed to insert activities:', insErr);
          throw new Error(`Failed to insert activities: ${insErr.message}`);
        }

        console.log('Successfully inserted activities:', insertedRows);
      } else {
        console.log('No activities to insert');
      }

      // 3. Regenerate meal plans for this week only
      console.log('Starting meal plan generation...');

      const startDate = format(startDateObj, 'yyyy-MM-dd');
      const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      
      console.log('Invoking meal plan generation for:', {
        startDate,
        weeks: 1
      });

      const { data: mealPlanData, error: mealPlanError } = await supabase.functions.invoke('generate-meal-plan-range', {
        body: { startDate, weeks: 1 },
        headers: {
          ...(apiKey ? { apikey: apiKey } : {}),
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (mealPlanError) {
        console.error('Meal plan generation failed:', mealPlanError);
        // Don't throw here as meal plan generation is not critical
        toast({
          title: "Note",
          description: "Goals saved, but meal plan generation failed. Your meal plans may need to be regenerated.",
          variant: "default",
        });
      } else {
        console.log('Meal plan generation successful:', mealPlanData);
      }

      toast({
        title: "Goals & Weekly Pattern saved!",
        description: "Your running goal and base weekly training pattern have been saved",
      });

    } catch (error) {
      console.error('Error in handleSaveGoals:', error);
      // More detailed error logging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      // If it's a Supabase error, it might have additional details
      const supabaseError = error as any;
      if (supabaseError?.code || supabaseError?.details || supabaseError?.hint) {
        console.error('Supabase error details:', {
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint
        });
      }
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

  const isStep2Complete = () => true;

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
          <div className="mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="-ml-2 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 mb-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg sm:h-12 sm:w-12">
              <Target className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <PageHeading
              title="Set Your Goals & Training Plan"
              description="Define your running goal and create your weekly training schedule."
              className="!mb-0 flex-1"
            />
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
                      <SelectItem value="5k">5K (5 km)</SelectItem>
                      <SelectItem value="10k">10K (10 km)</SelectItem>
                      <SelectItem value="half_marathon">Half Marathon (21.1 km)</SelectItem>
                      <SelectItem value="full_marathon">Full Marathon (42.2 km)</SelectItem>
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

          {/* Step 2: Training Plan (inline weekly editor) */}
          {currentStep === 2 && (
            <Card className="shadow-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  Step 2: Create Your Weekly Training Plan
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Plan your base weekly training pattern. This will be used by our weekly generator to create your full training plan.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Base weekly pattern (Monday–Sunday) - One week only
                  </div>
                  <div className="flex items-center gap-2"></div>
                </div>
                {/* Weekly Editor */}
                <div className="space-y-4">
                  {datesOfWeek.map((d, idx) => {
                    const key = format(d, 'yyyy-MM-dd');
                    const list = activitiesByDate[key] || [];
                    return (
                      <div key={key} className="rounded-lg border bg-muted/20 overflow-visible">
                        <div className="flex items-center justify-between border-b px-4 py-2">
                          <div className="text-sm font-semibold">{DAYS[idx]}</div>
                          <Button variant="outline" size="sm" className="h-8" onClick={() => addActivity(key)}>+ Add Activity</Button>
                        </div>
                        <div className="space-y-3 p-4">
                          {list.length === 0 && (
                            <div className="text-xs text-muted-foreground">No activities planned yet.</div>
                          )}
                          {list.map((a, i) => {
                            const uiType = deriveUiActivityType(a);
                            const isExpanded = expandedEditor && expandedEditor.date === key && expandedEditor.index === i;
                            
                            console.log(`Activity ${i} for ${key}:`, {
                              activity: a,
                              uiType,
                              isExpanded,
                              expandedEditor,
                              currentDate: key,
                              currentIndex: i
                            });
                            const metrics =
                              uiType === 'rest'
                                ? 'Recovery focus'
                                : [
                                    a.activity_type === 'run' && a.distance_km ? `${a.distance_km} km` : null,
                                    a.duration_minutes ? `${a.duration_minutes} min` : null,
                                    a.intensity ? `${formatIntensity(a.intensity)}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ');
                            return (
                              <div key={i} className="rounded-md bg-background/60 p-3 shadow-sm">
                                {!isExpanded && (
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold">{getUiActivityLabel(uiType)}</span>
                                      <span className="text-muted-foreground">{metrics}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold">
                                        {uiType === 'rest'
                                          ? '0 kcal'
                                          : a.estimated_calories
                                          ? `${a.estimated_calories} kcal`
                                          : '—'}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2"
                                        onClick={() => handleEditActivity(key, i)}
                                      >
                                        Edit
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {isExpanded && (
                                  <div className="space-y-3">
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div className="space-y-1 overflow-visible">
                                        <Label className="text-xs">Activity</Label>
                                        <Select
                                          value={uiType}
                                          onValueChange={(v) =>
                                            updateActivity(key, i, (current) =>
                                              applyUiActivityType(v as UiActivityType, current)
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-9 text-sm relative z-10">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="z-50 w-[var(--radix-select-trigger-width)] min-w-0">
                                            <SelectItem value="run">Run</SelectItem>
                                            <SelectItem value="long_run">Long Run</SelectItem>
                                            <SelectItem value="interval">Interval Session</SelectItem>
                                            <SelectItem value="strength">Strength Training</SelectItem>
                                            <SelectItem value="rest">Rest Day</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1 overflow-visible">
                                        <Label className="text-xs">Intensity</Label>
                                        <Select
                                          value={a.intensity}
                                          onValueChange={(v: Intensity) => updateActivity(key, i, { intensity: v })}
                                          disabled={uiType === 'rest'}
                                        >
                                          <SelectTrigger className="h-9 text-sm relative z-10">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="z-50 w-[var(--radix-select-trigger-width)] min-w-0">
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="moderate">Moderate</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    {uiType === 'rest' ? (
                                      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                                        No metrics needed for a rest day. Use this time for recovery, mobility, or gentle
                                        stretching.
                                      </div>
                                    ) : (
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            {a.activity_type === 'run' ? 'Distance (km)' : 'Duration (min)'}
                                          </Label>
                                          {a.activity_type === 'run' ? (
                                            <Input
                                              className="h-9 text-sm"
                                              type="number"
                                              step="0.1"
                                              value={typeof a.distance_km === 'number' ? a.distance_km : ''}
                                              onChange={(e) =>
                                                updateActivity(key, i, {
                                                  distance_km: e.target.value === '' ? null : parseFloat(e.target.value),
                                                })
                                              }
                                            />
                                          ) : (
                                            <Input
                                              className="h-9 text-sm"
                                              type="number"
                                              value={a.duration_minutes}
                                              onChange={(e) =>
                                                updateActivity(key, i, {
                                                  duration_minutes: parseInt(e.target.value) || 0,
                                                })
                                              }
                                            />
                                          )}
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">
                                            {a.activity_type === 'run' ? 'Duration (min)' : 'Notes'}
                                          </Label>
                                          {a.activity_type === 'run' ? (
                                            <Input
                                              className="h-9 text-sm"
                                              type="number"
                                              value={a.duration_minutes}
                                              onChange={(e) =>
                                                updateActivity(key, i, {
                                                  duration_minutes: parseInt(e.target.value) || 0,
                                                })
                                              }
                                            />
                                          ) : (
                                            <Input
                                              className="h-9 text-sm"
                                              placeholder="Optional notes"
                                              value={a.notes ?? ''}
                                              onChange={(e) => updateActivity(key, i, { notes: e.target.value })}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap justify-between gap-2 pt-1">
                                      <div className="text-xs text-muted-foreground">
                                        Estimated energy cost: {a.estimated_calories} kcal
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2"
                                          onClick={handleCloseEditor}
                                        >
                                          Done
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-destructive"
                                          onClick={() => removeActivity(key, i)}
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Step Navigation */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
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
