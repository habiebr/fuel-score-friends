import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Target, Upload, Calendar, Zap, CheckCircle, Dumbbell, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addDays, format, startOfWeek } from 'date-fns';

type ActivityType = 'rest' | 'run' | 'strength' | 'cardio' | 'other';
type Intensity = 'low' | 'moderate' | 'high';

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
  
  // Step 2: Training Plan (inline editor using training_activities)
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
        duration_minutes: 30,
        distance_km: null,
        intensity: 'moderate',
        start_time: null,
        estimated_calories: 300,
        notes: null,
      };
      base.estimated_calories = calculateCalories(base);
      next[dateStr] = [...(next[dateStr] || []), base];
      return next;
    });
    const idx = (activitiesByDate[dateStr]?.length || 0);
    setExpandedEditor({ date: dateStr, index: idx });
  };

  const updateActivity = (dateStr: string, index: number, patch: Partial<TrainingActivity>) => {
    setActivitiesByDate((prev) => {
      const next = { ...prev };
      const list = [...(next[dateStr] || [])];
      const updated = { ...list[index], ...patch } as TrainingActivity;
      updated.estimated_calories = calculateCalories(updated);
      list[index] = updated;
      next[dateStr] = list;
      return next;
    });
  };

  const removeActivity = (dateStr: string, index: number) => {
    setActivitiesByDate((prev) => {
      const next = { ...prev };
      next[dateStr] = (next[dateStr] || []).filter((_, i) => i !== index);
      return next;
    });
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

      // 2. Persist weekly pattern by repeating until race date
      const startDateObj = datesOfWeek[0];
      const endRepeat = targetDate ? new Date(targetDate) : addDays(weekStart, 6);

      // delete existing between start and race date
      const { error: delErr } = await (supabase as any)
        .from('training_activities')
        .delete()
        .eq('user_id', user.id)
        .gte('date', format(startDateObj, 'yyyy-MM-dd'))
        .lte('date', format(endRepeat, 'yyyy-MM-dd'));
      if (delErr) throw delErr;

      const patternDates = datesOfWeek.map((d) => format(d, 'yyyy-MM-dd'));
      const rows: any[] = [];
      for (let dt = new Date(startDateObj); dt <= endRepeat; dt = addDays(dt, 1)) {
        const key = format(dt, 'yyyy-MM-dd');
        const weekdayIndex = (dt.getDay() + 6) % 7; // Mon=0 ... Sun=6
        const patternDate = patternDates[weekdayIndex];
        const acts = activitiesByDate[patternDate] || [];
        acts.forEach((act) => {
          rows.push({
            user_id: user.id,
            date: key,
            activity_type: act.activity_type,
            start_time: act.start_time,
            duration_minutes: act.duration_minutes,
            distance_km: act.distance_km,
            intensity: act.intensity,
            estimated_calories: act.estimated_calories,
            notes: act.notes,
          });
        });
      }

      if (rows.length > 0) {
        const { error: insErr } = await (supabase as any).from('training_activities').insert(rows);
        if (insErr) throw insErr;
      }

      // 3. Regenerate meal plans for the next 7 weeks
      const startDate = format(startDateObj, 'yyyy-MM-dd');
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

          {/* Step 2: Training Plan (inline weekly editor) */}
          {currentStep === 2 && (
            <Card className="shadow-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  Step 2: Create Your Weekly Training Plan
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Plan your weekly schedule. This pattern repeats until your race date.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Weekly pattern (Mon–Sun)
                  </div>
                  <div className="flex items-center gap-2"></div>
                </div>
                {/* Weekly Editor */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {datesOfWeek.map((d, idx) => {
                    const key = format(d, 'yyyy-MM-dd');
                    const list = activitiesByDate[key] || [];
                    return (
                      <div key={key} className="p-3 border rounded-lg">
                        <div className="text-sm font-semibold mb-2">{DAYS[idx]}</div>
                        <div className="space-y-2">
                          {list.length === 0 && (
                            <div className="text-xs text-muted-foreground">No activities</div>
                          )}
                          {list.map((a, i) => {
                            const isExpanded = expandedEditor && expandedEditor.date === key && expandedEditor.index === i;
                            return (
                              <div key={i} className="p-2 rounded bg-muted/50">
                                {!isExpanded && (
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="font-medium capitalize">{a.activity_type}</div>
                                    <div className="text-muted-foreground">{a.activity_type === 'run' ? (a.distance_km ? `${a.distance_km} km` : `${a.duration_minutes} min`) : `${a.duration_minutes} min`} · {a.intensity}</div>
                                    <div className="font-semibold">{a.estimated_calories} kcal</div>
                                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpandedEditor({ date: key, index: i })}>Edit</Button>
                                  </div>
                                )}
                                {isExpanded && (
                                  <div className="mt-2">
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Type</Label>
                                        <Select value={a.activity_type} onValueChange={(v: any) => updateActivity(key, i, { activity_type: v as ActivityType, distance_km: a.activity_type === 'run' ? a.distance_km : null })}>
                                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="run">Running</SelectItem>
                                            <SelectItem value="strength">Strength</SelectItem>
                                            <SelectItem value="cardio">Cardio</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Intensity</Label>
                                        <Select value={a.intensity} onValueChange={(v: any) => updateActivity(key, i, { intensity: v as Intensity })}>
                                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="moderate">Moderate</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {a.activity_type === 'run' ? (
                                        <div className="space-y-1">
                                          <Label className="text-xs">Distance (km)</Label>
                                          <Input className="h-8" type="number" step="0.1" value={typeof a.distance_km === 'number' ? a.distance_km : ''} onChange={(e) => updateActivity(key, i, { distance_km: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <Label className="text-xs">Duration (min)</Label>
                                          <Input className="h-8" type="number" value={a.duration_minutes} onChange={(e) => updateActivity(key, i, { duration_minutes: parseInt(e.target.value) || 0 })} />
                                        </div>
                                      )}
                                      <div className="flex items-end gap-2">
                                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setExpandedEditor(null)}>Done</Button>
                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => removeActivity(key, i)}>Remove</Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <Button variant="outline" size="sm" className="h-8" onClick={() => addActivity(key)}>+ Add Activity</Button>
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
