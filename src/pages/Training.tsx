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
      const { data, error } = await supabase
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
      const { error: delErr } = await supabase
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
        const { error: insErr } = await supabase.from('training_activities').insert(rows);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Weekly Training</h1>
              <p className="text-sm text-muted-foreground">Plan multiple activities per day</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>Prev</Button>
              <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next</Button>
              <Button onClick={saveAll} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Summary</span>
                <span className="text-primary font-semibold">{weeklyCalories} kcal</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {datesOfWeek.map((d, idx) => {
                  const key = format(d, 'yyyy-MM-dd');
                  const list = activitiesByDate[key] || [];
                  return (
                    <div key={key} className="p-3 border rounded-lg">
                      <div className="text-sm font-semibold mb-2">{DAYS[idx]} ({format(d, 'MM/dd')})</div>
                      <div className="space-y-2">
                        {list.length === 0 && (
                          <div className="text-xs text-muted-foreground">No activities</div>
                        )}
                        {list.map((a, i) => (
                          <div key={i} className="p-2 rounded bg-muted/50">
                            <div className="text-xs font-medium mb-2">{a.activity_type} · {a.estimated_calories} kcal</div>
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
                              <div className="flex items-end">
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => removeActivity(key, i)}>Remove</Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="h-8" onClick={() => addActivity(key)}>+ Add Activity</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </>
  );
}


