import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, startOfWeek } from 'date-fns';
import { PageHeading } from '@/components/PageHeading';
import { ChevronDown, ChevronUp, Activity, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TrainingNutritionWidget } from '@/components/TrainingNutritionWidget';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  is_actual?: boolean; // Flag to distinguish actual vs planned activities
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TrainingCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const datesOfWeek = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [activitiesByDate, setActivitiesByDate] = useState<Record<string, TrainingActivity[]>>({});
  const [loading, setLoading] = useState(true);
  const [isNutritionExpanded, setIsNutritionExpanded] = useState(false);

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
          .order('date', { ascending: true })
          .order('is_actual', { ascending: false }); // Actual activities first
        if (error) throw error;
        const grouped: Record<string, TrainingActivity[]> = {};
        for (const d of datesOfWeek) grouped[format(d, 'yyyy-MM-dd')] = [];
        
        // Process activities and prioritize actual over planned
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
            is_actual: row.is_actual || false, // Add is_actual flag
          };
          
          // If there's already an actual activity for this date, replace planned activities
          if (act.is_actual) {
            // Remove any existing planned activities for this date
            grouped[key] = [act];
          } else {
            // Only add planned activity if no actual activity exists for this date
            if (!grouped[key] || grouped[key].length === 0 || !grouped[key][0].is_actual) {
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(act);
            }
          }
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
        <div className="max-w-none mx-auto p-4">
                 <PageHeading
                   title="Training Calendar"
                   description="Weekly view of your training plan"
                   icon={Calendar}
                 />

          {/* Navigation Controls */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Prev
            </Button>
            <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next
            </Button>
          </div>

          {/* Actual/Planned Training widget */}
          <div className="mb-6">
            <Collapsible open={isNutritionExpanded} onOpenChange={setIsNutritionExpanded}>
              <Card className="shadow-card">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Training</CardTitle>
                          <CardDescription>
                            {isNutritionExpanded 
                              ? 'Click to hide training summary'
                              : 'Click to view today\'s actual/planned training'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isNutritionExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <TrainingNutritionWidget
                      selectedDate={new Date()}
                      activities={Object.values(activitiesByDate).flat()}
                      tomorrowActivities={activitiesByDate[format(addDays(new Date(), 1), 'yyyy-MM-dd')] || []}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
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
                const hasActualActivity = list.some(a => a.is_actual);
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
                            <div className="flex items-center gap-2">
                              <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Day {idx + 1}</p>
                              {hasActualActivity && (
                                <span className="rounded-full bg-green-100 dark:bg-green-900/20 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                                  Actual Data
                                </span>
                              )}
                            </div>
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
                                    <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(49,255,176,0.5)] ${
                                      a.is_actual ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-primary'
                                    }`} />
                                    <span className="text-sm font-semibold capitalize">{a.activity_type}</span>
                                    {a.is_actual && (
                                      <span className="rounded-full bg-green-100 dark:bg-green-900/20 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                                        Actual
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{a.intensity}</span>
                                    {a.is_actual && (
                                      <span className="text-xs text-green-600 dark:text-green-400">✓</span>
                                    )}
                                  </div>
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
