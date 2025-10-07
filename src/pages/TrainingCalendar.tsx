import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, startOfWeek } from 'date-fns';

type ActivityType = 'rest' | 'run' | 'strength' | 'cardio' | 'other';
type Intensity = 'low' | 'moderate' | 'high';

interface TrainingActivity {
  id?: string;
  date: string;
  activity_type: ActivityType;
  start_time?: string | null;
  duration_minutes: number;
  distance_km?: number | null;
  intensity: Intensity;
  estimated_calories: number;
  notes?: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TrainingCalendar() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const datesOfWeek = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [activitiesByDate, setActivitiesByDate] = useState<Record<string, TrainingActivity[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const start = format(weekStart, 'yyyy-MM-dd');
        const end = format(addDays(weekStart, 6), 'yyyy-MM-dd');
        const { data, error } = await (supabase as any)
          .from('training_activities')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true });
        if (error) throw error;
        const grouped: Record<string, TrainingActivity[]> = {};
        for (const d of datesOfWeek) grouped[format(d, 'yyyy-MM-dd')] = [];
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
      } finally {
        setLoading(false);
      }
    })();
  }, [user, weekStart]);

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Training Calendar</h1>
              <p className="text-sm text-muted-foreground">Weekly view of your training plan</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>Prev</Button>
              <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next</Button>
            </div>
          </div>

          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold">
                Week of {format(datesOfWeek[0], 'MM/dd')} - {format(datesOfWeek[6], 'MM/dd')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {datesOfWeek.map((d, idx) => {
                const key = format(d, 'yyyy-MM-dd');
                const list = activitiesByDate[key] || [];
                const totalDistance = list.reduce((sum, a) => sum + (a.distance_km || 0), 0);
                const totalDuration = list.reduce((sum, a) => sum + (a.duration_minutes || 0), 0);
                const totalCalories = list.reduce((sum, a) => sum + (a.estimated_calories || 0), 0);
                const isRestDay = !loading && list.length === 0;
                const primarySummary =
                  totalDistance > 0
                    ? `${parseFloat(totalDistance.toFixed(totalDistance >= 10 ? 0 : 1))} km`
                    : totalDuration > 0
                    ? `${totalDuration} min`
                    : 'Rest day';
                const intensitySummary = isRestDay ? 'rest' : list.length === 1 ? list[0].intensity : 'mixed';

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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Day {idx + 1}</p>
                            <h3 className="text-lg font-semibold">{DAYS[idx]}</h3>
                            <p className="text-xs text-muted-foreground">{format(d, 'EEEE, MMM dd')}</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {loading && <div className="text-xs text-muted-foreground">Loading...</div>}
                          {!loading && list.length === 0 && (
                            <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/50 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
                              Rest day — keep nutrition on point.
                              <span className="text-xs uppercase tracking-wide text-muted-foreground/70">No activity</span>
                            </div>
                          )}

                          {list.map((a, i) => {
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
                                className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm shadow-inner shadow-black/10 backdrop-blur"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(49,255,176,0.5)]" />
                                    <span className="text-sm font-semibold capitalize">{a.activity_type}</span>
                                  </div>
                                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{a.intensity}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold text-foreground">{primaryMetric}</span>
                                    <span>{metricLabel}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="font-semibold text-foreground">{a.estimated_calories}</span>
                                    <span>kcal</span>
                                  </div>
                                  {startTimeLabel && (
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold text-foreground">{startTimeLabel}</span>
                                      <span>start</span>
                                    </div>
                                  )}
                                </div>
                                {a.notes && (
                                  <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                                    {a.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
