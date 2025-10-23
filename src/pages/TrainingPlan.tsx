import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { ChevronLeft, Calendar, Zap, CheckCircle, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addDays, format, startOfWeek } from 'date-fns';
import { PageHeading } from '@/components/PageHeading';

type ActivityType = 'rest' | 'run' | 'strength' | 'cardio' | 'other';
type Intensity = 'low' | 'moderate' | 'high';
type UiActivityType = 'run' | 'long_run' | 'interval' | 'strength' | 'rest';

interface TrainingActivity {
  id?: string;
  date: string; // yyyy-MM-dd
  activity_type: ActivityType;
  user_activity_label?: string | null; // User's explicit selection: long_run, interval, etc.
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
  // Store user's explicit activity label
  next.user_activity_label = uiType;
  
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
      next.duration_minutes = Math.max(30, next.duration_minutes || 30);
      if (next.intensity === 'low') next.intensity = 'moderate';
      break;
  }
  return next;
};

const calculateCalories = (activity: TrainingActivity): number => {
  const baseCalories = activity.activity_type === 'run' 
    ? (activity.distance_km || 0) * 60 + (activity.duration_minutes || 0) * 2
    : (activity.duration_minutes || 0) * 8;
  
  const intensityMultiplier = activity.intensity === 'high' ? 1.3 : activity.intensity === 'moderate' ? 1.1 : 0.9;
  return Math.round(baseCalories * intensityMultiplier);
};

export default function TrainingPlan() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Training Plan State
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const datesOfWeek = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [activitiesByDate, setActivitiesByDate] = useState<Record<string, TrainingActivity[]>>({});
  const [expandedEditor, setExpandedEditor] = useState<{ date: string; index: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadTrainingPlan();
    }
  }, [user, weekStart]);

  const loadTrainingPlan = async () => {
    if (!user) return;
    
    setLoading(true);
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

      if (actErr) {
        console.error('Error loading training activities:', actErr);
        setActivitiesByDate({});
        return;
      }

      // Group activities by date
      const grouped: Record<string, TrainingActivity[]> = {};
      (acts || []).forEach((act: any) => {
        if (!grouped[act.date]) grouped[act.date] = [];
        grouped[act.date].push(act);
      });
      setActivitiesByDate(grouped);
    } catch (error) {
      console.error('Error loading training plan:', error);
      setActivitiesByDate({});
    } finally {
      setLoading(false);
    }
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
    // Open the just-added activity editor
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
  };

  const saveTrainingPlan = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const start = format(weekStart, 'yyyy-MM-dd');
      const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      
      // Delete existing activities for this week
      const { error: delErr } = await (supabase as any)
        .from('training_activities')
        .delete()
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);
      
      if (delErr) throw delErr;

      // Insert new activities
      const rows: any[] = [];
      Object.entries(activitiesByDate).forEach(([date, activities]) => {
        activities.forEach((act) => {
          rows.push({
            user_id: user.id,
            date: act.date,
            activity_type: act.activity_type,
            user_activity_label: act.user_activity_label,
            start_time: act.start_time,
            duration_minutes: act.duration_minutes,
            distance_km: act.distance_km,
            intensity: act.intensity,
            estimated_calories: act.estimated_calories,
            notes: act.notes,
          });
        });
      });

      if (rows.length > 0) {
        const { error: insertErr } = await (supabase as any)
          .from('training_activities')
          .insert(rows);
        
        if (insertErr) throw insertErr;
      }

      toast({
        title: 'Training plan saved!',
        description: 'Your weekly training plan has been updated.',
      });

      // Navigate back to training page
      navigate('/training');

    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: 'Could not save your training plan',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const weeklyCalories = useMemo(() => {
    return datesOfWeek.reduce((sum, d) => {
      const key = format(d, 'yyyy-MM-dd');
      return sum + (activitiesByDate[key] || []).reduce((s, a) => s + a.estimated_calories, 0);
    }, 0);
  }, [activitiesByDate, datesOfWeek]);

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
              title="Create Your Training Plan"
              description="Map out your weekly training schedule to achieve your goals."
              className="!mb-0 flex-1"
            />
          </div>

          {/* Progress Indicator */}
          <div className="mb-8 overflow-hidden">
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-4">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-primary text-primary-foreground">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span className="text-xs sm:text-sm font-medium">Running Goal</span>
              </div>
              <div className="w-8 h-0.5 bg-primary"></div>
              <div className="flex items-center space-x-2 text-primary">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-primary text-primary-foreground">
                  2
                </div>
                <span className="text-xs sm:text-sm font-medium">Training Plan</span>
              </div>
            </div>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Previous Week
            </Button>
            <span className="px-4 py-2 text-sm font-medium">
              Week of {format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd')}
            </span>
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next Week
            </Button>
          </div>

          {/* Training Plan Editor */}
          <Card className="shadow-card mb-6 w-full max-w-full">
            <CardHeader className="w-full max-w-full box-border">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Weekly Training Plan
                </span>
                <span className="text-primary font-semibold">{weeklyCalories} kcal</span>
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Map out your typical training week. We'll use this as a template to create your personalized training plan.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 w-full max-w-full box-border">
              {datesOfWeek.map((d, idx) => {
                const key = format(d, 'yyyy-MM-dd');
                const list = activitiesByDate[key] || [];
                const totalDistance = list.reduce((sum, a) => sum + (a.distance_km || 0), 0);
                const totalDuration = list.reduce((sum, a) => sum + (a.duration_minutes || 0), 0);
                const totalCalories = list.reduce((sum, a) => sum + (a.estimated_calories || 0), 0);
                const primarySummary =
                  totalDistance > 0
                    ? `${parseFloat(totalDistance.toFixed(totalDistance >= 10 ? 0 : 1))} km`
                    : totalDuration > 0
                    ? `${totalDuration} min`
                    : 'Rest day';
                const intensitySummary = list.length === 0 ? 'rest' : list.length === 1 ? list[0].intensity : 'mixed';

                return (
                  <div
                    key={key}
                    className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/75 p-5 shadow-card backdrop-blur"
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-primary/5 via-transparent to-primary/10 opacity-70" />
                    <div className="relative flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-lg font-semibold text-foreground">
                        {format(d, 'dd')}
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Day {idx + 1}</p>
                            <h3 className="text-lg font-semibold">{DAYS[idx]}</h3>
                            <p className="text-xs text-muted-foreground">{format(d, 'EEEE, MMM dd')}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {list.length === 0 && (
                            <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/50 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
                              No activities scheduled — tap below to add one.
                              <span className="text-xs uppercase tracking-wide text-muted-foreground/70">Rest day</span>
                            </div>
                          )}

                          {list.map((a, i) => {
                            const isExpanded = expandedEditor && expandedEditor.date === key && expandedEditor.index === i;
                            const isRun = a.activity_type === 'run';
                            const primaryMetric = isRun
                              ? a.distance_km
                                ? `${a.distance_km} km`
                                : `${a.duration_minutes} min`
                              : `${a.duration_minutes} min`;
                            const metricLabel = isRun && a.distance_km ? 'distance' : 'duration';
                            const startTimeLabel = a.start_time
                              ? format(new Date(`1970-01-01T${a.start_time}`), 'hh:mm a')
                              : null;

                            return (
                              <div
                                key={i}
                                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm shadow-inner shadow-black/10 backdrop-blur"
                              >
                                {!isExpanded && (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(49,255,176,0.5)]" />
                                          <span className="text-sm font-semibold capitalize">{a.activity_type}</span>
                                        </div>
                                        <span className="text-muted-foreground uppercase tracking-wide">{a.intensity}</span>
                                        <span className="text-muted-foreground">{primaryMetric}</span>
                                      </div>
                                      <div className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                                        <span className="font-semibold">{a.estimated_calories} kcal</span>
                                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpandedEditor({ date: key, index: i })}>
                                          Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700" onClick={() => removeActivity(key, i)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                    {a.notes && (
                                      <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                                        {a.notes}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {isExpanded && (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      <div className="space-y-1">
                                        <Label>Activity Type</Label>
                                        <Select
                                          value={a.user_activity_label || deriveUiActivityType(a)}
                                          onValueChange={(value: UiActivityType) => {
                                            const updated = applyUiActivityType(value, a);
                                            updateActivity(key, i, updated);
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="run">Easy Run</SelectItem>
                                            <SelectItem value="long_run">Long Run</SelectItem>
                                            <SelectItem value="interval">Interval Session</SelectItem>
                                            <SelectItem value="strength">Strength Training</SelectItem>
                                            <SelectItem value="rest">Rest Day</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      {a.activity_type !== 'rest' && (
                                        <div className="space-y-1">
                                          <Label>Start Time (optional)</Label>
                                          <Input
                                            type="time"
                                            value={a.start_time || ''}
                                            onChange={(e) => updateActivity(key, i, { start_time: e.target.value || null })}
                                          />
                                        </div>
                                      )}

                                      {a.activity_type === 'run' && (
                                        <>
                                          <div className="space-y-1">
                                            <Label>Distance (km)</Label>
                                            <Input
                                              type="number"
                                              step="0.1"
                                              value={a.distance_km || ''}
                                              onChange={(e) => updateActivity(key, i, { distance_km: parseFloat(e.target.value) || null })}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label>Duration (minutes)</Label>
                                            <Input
                                              type="number"
                                              value={a.duration_minutes}
                                              onChange={(e) => updateActivity(key, i, { duration_minutes: parseInt(e.target.value) || 0 })}
                                            />
                                          </div>
                                        </>
                                      )}

                                      {a.activity_type !== 'run' && a.activity_type !== 'rest' && (
                                        <div className="space-y-1">
                                          <Label>Duration (minutes)</Label>
                                          <Input
                                            type="number"
                                            value={a.duration_minutes}
                                            onChange={(e) => updateActivity(key, i, { duration_minutes: parseInt(e.target.value) || 0 })}
                                          />
                                        </div>
                                      )}

                                      <div className="space-y-1">
                                        <Label>Intensity</Label>
                                        <Select
                                          value={a.intensity}
                                          onValueChange={(value: Intensity) => updateActivity(key, i, { intensity: value })}
                                        >
                                          <SelectTrigger>
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

                                    <div className="space-y-1">
                                      <Label>Notes (optional)</Label>
                                      <Input
                                        placeholder="Add any notes about this session..."
                                        value={a.notes || ''}
                                        onChange={(e) => updateActivity(key, i, { notes: e.target.value || null })}
                                      />
                                    </div>

                                    <div className="flex justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setExpandedEditor(null)}
                                      >
                                        Done
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addActivity(key)}
                            className="w-full border-dashed"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Activity
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={saveTrainingPlan}
              disabled={saving}
              className="flex-1 sm:flex-none"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Save Training Plan
                </>
              )}
            </Button>
          </div>

          {/* Help Text */}
          <Card className="border-blue-200 dark:border-blue-800 mt-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Training Plan Tips
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Include at least one rest day per week</li>
                    <li>• Mix easy runs with harder sessions</li>
                    <li>• Long runs should be 20-30% of your weekly volume</li>
                    <li>• Start with shorter distances and build up gradually</li>
                  </ul>
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

