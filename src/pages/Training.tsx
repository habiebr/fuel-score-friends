import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addDays, format, startOfWeek } from 'date-fns';
import { PageHeading } from '@/components/PageHeading';

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

export default function Training() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activitiesByDate, setActivitiesByDate] = useState<Record<string, TrainingActivity[]>>({});
  const [expandedEditor, setExpandedEditor] = useState<{ date: string; index: number } | null>(null);

  const datesOfWeek = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    if (!user) return;
    loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekStart]);

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

  const loadWeek = async () => {
    setLoading(true);
    try {
      const start = format(weekStart, 'yyyy-MM-dd');
      const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const { data, error } = await (supabase as any)
        .from('training_activities')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
      if (error) throw error;
      const grouped: Record<string, TrainingActivity[]> = {};
      for (const d of datesOfWeek) {
        grouped[format(d, 'yyyy-MM-dd')] = [];
      }
      (data || []).forEach((row: any) => {
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
      console.error('Failed to load training activities', e);
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

  const saveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const start = format(weekStart, 'yyyy-MM-dd');
      const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const { error: delErr } = await (supabase as any)
        .from('training_activities')
        .delete()
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);
      if (delErr) throw delErr;

      const rows: any[] = [];
      for (const d of datesOfWeek) {
        const dateStr = format(d, 'yyyy-MM-dd');
        for (const act of activitiesByDate[dateStr] || []) {
          rows.push({
            user_id: user.id,
            date: dateStr,
            activity_type: act.activity_type,
            start_time: act.start_time,
            duration_minutes: act.duration_minutes,
            distance_km: act.distance_km,
            intensity: act.intensity,
            estimated_calories: act.estimated_calories,
            notes: act.notes,
          });
        }
      }

      if (rows.length > 0) {
        const { error: insErr } = await (supabase as any).from('training_activities').insert(rows);
        if (insErr) throw insErr;
      }

      toast({ title: 'Training plan saved', description: 'Your weekly plan was updated.' });
    } catch (e) {
      console.error('Save failed', e);
      toast({ title: 'Save failed', description: 'Could not save your plan', variant: 'destructive' });
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

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4 space-y-4">
          <PageHeading
            title="Weekly Training"
            description="Plan multiple activities per day."
            actions={
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                  Prev
                </Button>
                <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                  Next
                </Button>
                <Button onClick={saveAll} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            }
          />

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl font-semibold">
                <span>Summary</span>
                <span className="text-primary font-semibold">{weeklyCalories} kcal</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(49,255,176,0.5)]" />
                                        <span className="text-sm font-semibold capitalize">{a.activity_type}</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="uppercase tracking-wide">{a.intensity}</span>
                                        <span>{primaryMetric}</span>
                                        <span>{a.estimated_calories} kcal</span>
                                      </div>
                                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpandedEditor({ date: key, index: i })}>
                                        Edit
                                      </Button>
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
                                        <Label className="text-xs">Type</Label>
                                        <Select
                                          value={a.activity_type}
                                          onValueChange={(v: any) =>
                                            updateActivity(key, i, {
                                              activity_type: v as ActivityType,
                                              distance_km: v === 'run' ? a.distance_km : null,
                                            })
                                          }
                                        >
                                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="run">Running</SelectItem>
                                            <SelectItem value="strength">Strength</SelectItem>
                                            <SelectItem value="cardio">Cardio</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                            <SelectItem value="rest">Rest</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Intensity</Label>
                                        <Select value={a.intensity} onValueChange={(v: any) => updateActivity(key, i, { intensity: v as Intensity })}>
                                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="moderate">Moderate</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      {a.activity_type === 'run' ? (
                                        <div className="space-y-1">
                                          <Label className="text-xs">Distance (km)</Label>
                                          <Input
                                            className="h-9"
                                            type="number"
                                            step="0.1"
                                            value={typeof a.distance_km === 'number' ? a.distance_km : ''}
                                            onChange={(e) =>
                                              updateActivity(key, i, {
                                                distance_km: e.target.value === '' ? null : parseFloat(e.target.value),
                                              })
                                            }
                                          />
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <Label className="text-xs">Duration (min)</Label>
                                          <Input
                                            className="h-9"
                                            type="number"
                                            value={a.duration_minutes}
                                            onChange={(e) => updateActivity(key, i, { duration_minutes: parseInt(e.target.value) || 0 })}
                                          />
                                        </div>
                                      )}
                                      <div className="space-y-1">
                                        <Label className="text-xs">Start Time (optional)</Label>
                                        <Input
                                          className="h-9"
                                          type="time"
                                          value={a.start_time ?? ''}
                                          onChange={(e) => updateActivity(key, i, { start_time: e.target.value || null })}
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Notes</Label>
                                      <Input
                                        className="h-9"
                                        value={a.notes ?? ''}
                                        onChange={(e) => updateActivity(key, i, { notes: e.target.value || null })}
                                        placeholder="Fueling cues, pacing, etc."
                                      />
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        Est. calories: <span className="font-semibold text-foreground">{a.estimated_calories}</span>
                                      </span>
                                      <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => setExpandedEditor(null)}>
                                        Done
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-3 text-destructive"
                                        onClick={() => {
                                          removeActivity(key, i);
                                          setExpandedEditor(null);
                                        }}
                                      >
                                        Remove
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
                            className="h-9 rounded-full border-primary/40 bg-background/70 text-xs font-semibold uppercase tracking-wide text-primary shadow-[0_12px_35px_rgba(49,255,176,0.25)] hover:border-primary hover:bg-primary/10 hover:text-primary-foreground"
                            onClick={() => addActivity(key)}
                          >
                            + Add Activity
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
