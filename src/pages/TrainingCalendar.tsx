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
            <CardHeader>
              <CardTitle>
                Week of {format(datesOfWeek[0], 'MM/dd')} - {format(datesOfWeek[6], 'MM/dd')}
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
                        {loading && <div className="text-xs text-muted-foreground">Loading...</div>}
                        {!loading && list.length === 0 && (
                          <div className="text-xs text-muted-foreground">No activities</div>
                        )}
                        {list.map((a, i) => (
                          <div key={i} className="p-2 rounded bg-muted/50">
                            <div className="flex items-center justify-between text-xs">
                              <div className="font-medium capitalize">{a.activity_type}</div>
                              <div className="text-muted-foreground">{a.activity_type === 'run' ? (a.distance_km ? `${a.distance_km} km` : `${a.duration_minutes} min`) : `${a.duration_minutes} min`} · {a.intensity}</div>
                              <div className="font-semibold">{a.estimated_calories} kcal</div>
                            </div>
                          </div>
                        ))}
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


