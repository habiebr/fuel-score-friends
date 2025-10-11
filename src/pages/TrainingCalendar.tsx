import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, startOfWeek } from 'date-fns';
import { PageHeading } from '@/components/PageHeading';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TrainingNutritionWidget } from '@/components/TrainingNutritionWidget';

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

interface DayActivities {
  planned?: TrainingActivity;
  actual?: TrainingActivity;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TrainingCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const datesOfWeek = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const [activitiesByDate, setActivitiesByDate] = useState<Record<string, DayActivities>>({});
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
          .order('date', { ascending: true })
          .order('is_actual', { ascending: false }); // Actual activities first
        if (error) throw error;
        
        const grouped: Record<string, DayActivities> = {};
        for (const d of datesOfWeek) grouped[format(d, 'yyyy-MM-dd')] = {};
        
        // Organize activities by date, separating planned and actual
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
            is_actual: row.is_actual || false,
          };
          
          if (!grouped[key]) grouped[key] = {};
          
          if (act.is_actual) {
            // Only keep the first actual activity
            if (!grouped[key].actual) {
              grouped[key].actual = act;
            }
          } else {
            // Only keep the first planned activity
            if (!grouped[key].planned) {
              grouped[key].planned = act;
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

          {/* Today's Training Widget - Only show when actual Google Fit activity is detected */}
          {(() => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const todayData = activitiesByDate[today];
            const hasActualActivityToday = todayData?.actual !== undefined;
            
            // Only render the widget if there's actual activity detected for today
            if (!hasActualActivityToday) return null;
            
            // Convert to array for widget compatibility
            const allActivities = Object.values(activitiesByDate).flatMap(day => 
              [day.actual, day.planned].filter(Boolean) as TrainingActivity[]
            );
            const tomorrowData = activitiesByDate[format(addDays(new Date(), 1), 'yyyy-MM-dd')];
            const tomorrowActivities = [tomorrowData?.actual, tomorrowData?.planned].filter(Boolean) as TrainingActivity[];
            
            return (
              <div className="mb-6">
                <TrainingNutritionWidget
                  selectedDate={new Date()}
                  activities={allActivities}
                  tomorrowActivities={tomorrowActivities}
                />
              </div>
            );
          })()}

          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold">
                Week of {format(datesOfWeek[0], 'MM/dd')} - {format(datesOfWeek[6], 'MM/dd')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {datesOfWeek.map((d, idx) => {
                const key = format(d, 'yyyy-MM-dd');
                const dayData = activitiesByDate[key] || {};
                
                // Use actual data if available, otherwise use planned
                const displayActivity = dayData.actual || dayData.planned;
                const hasActualActivity = dayData.actual !== undefined;
                const isRestDay = !loading && !displayActivity;
                
                const totalDistance = displayActivity?.distance_km || 0;
                const totalDuration = displayActivity?.duration_minutes || 0;
                const totalCalories = displayActivity?.estimated_calories || 0;
                
                const primarySummary =
                  totalDistance > 0
                    ? `${parseFloat(totalDistance.toFixed(totalDistance >= 10 ? 0 : 1))} km`
                    : totalDuration > 0
                    ? `${totalDuration} min`
                    : 'Rest day';
                const intensitySummary = isRestDay ? 'rest' : displayActivity?.intensity || 'moderate';

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
                          {!loading && isRestDay && (
                            <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/50 bg-background/50 px-4 py-3 text-sm text-muted-foreground">
                              Rest day — keep nutrition on point.
                              <span className="text-xs uppercase tracking-wide text-muted-foreground/70">No activity</span>
                            </div>
                          )}

                          {/* Show actual activity if exists */}
                          {displayActivity && (
                            <div className="space-y-2">
                              {/* Actual Activity Card */}
                              {hasActualActivity && dayData.actual && (
                                <div className="flex flex-col gap-2 rounded-2xl border-2 border-green-500/30 bg-gradient-to-br from-green-50/80 to-emerald-50/60 dark:from-green-900/20 dark:to-emerald-900/10 px-4 py-3 text-sm shadow-lg shadow-green-500/10 backdrop-blur">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                      <span className="text-sm font-bold capitalize text-green-900 dark:text-green-100">{dayData.actual.activity_type}</span>
                                      <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                                        ACTUAL
                                      </span>
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-300">{dayData.actual.intensity}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-green-700 dark:text-green-300">
                                    {dayData.actual.activity_type === 'run' && dayData.actual.distance_km ? (
                                      <>
                                        <div className="flex items-center gap-1">
                                          <span className="font-bold text-green-900 dark:text-green-100">{dayData.actual.distance_km} km</span>
                                          <span>distance</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="font-semibold">{dayData.actual.duration_minutes} min</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold text-green-900 dark:text-green-100">{dayData.actual.duration_minutes} min</span>
                                        <span>duration</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold">{dayData.actual.estimated_calories} kcal</span>
                                    </div>
                                    {dayData.actual.start_time && (
                                      <div className="flex items-center gap-1">
                                        <span>{format(new Date(`1970-01-01T${dayData.actual.start_time}`), 'hh:mm a')}</span>
                                      </div>
                                    )}
                                  </div>
                                  {dayData.actual.notes && (
                                    <p className="text-xs italic text-green-600 dark:text-green-400">{dayData.actual.notes}</p>
                                  )}
                                </div>
                              )}

                              {/* Planned Activity Card (shown for comparison when actual exists, or as main card when no actual) */}
                              {dayData.planned && (
                                <div className={`flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm backdrop-blur ${
                                  hasActualActivity 
                                    ? 'border border-dashed border-border/40 bg-background/30 opacity-60' 
                                    : 'border border-border/60 bg-background/70 shadow-inner shadow-black/10'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${hasActualActivity ? 'bg-gray-400' : 'bg-primary'}`} />
                                      <span className="text-sm font-semibold capitalize">{dayData.planned.activity_type}</span>
                                      {hasActualActivity && (
                                        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                                          Planned
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{dayData.planned.intensity}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                    {dayData.planned.activity_type === 'run' && dayData.planned.distance_km ? (
                                      <>
                                        <div className="flex items-center gap-1">
                                          <span className="font-semibold text-foreground">{dayData.planned.distance_km} km</span>
                                          <span>distance</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="font-semibold">{dayData.planned.duration_minutes} min</span>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <span className="font-semibold text-foreground">{dayData.planned.duration_minutes} min</span>
                                        <span>duration</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1">
                                      <span className="font-semibold">{dayData.planned.estimated_calories} kcal</span>
                                    </div>
                                    {dayData.planned.start_time && (
                                      <div className="flex items-center gap-1">
                                        <span>{format(new Date(`1970-01-01T${dayData.planned.start_time}`), 'hh:mm a')}</span>
                                      </div>
                                    )}
                                  </div>
                                  {dayData.planned.notes && (
                                    <p className="text-xs italic text-muted-foreground">{dayData.planned.notes}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
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
