import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Loader2, Wand2, ShoppingCart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type PlanRow = {
  id: string;
  user_id: string;
  date: string;
  meal_type: string;
  recommended_calories: number;
  recommended_protein_grams?: number | null;
  recommended_carbs_grams?: number | null;
  recommended_fat_grams?: number | null;
  meal_suggestions?: any[] | null;
};

export default function MealPlans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date());
  const [plansByDate, setPlansByDate] = useState<Record<string, PlanRow[]>>({});
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const [trainingDays, setTrainingDays] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadWeeklyPlans(), loadTrainingDays()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, startDate]);

  const loadWeeklyPlans = async () => {
    if (!user) return;
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(addDays(startDate, 6), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('daily_meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true });

    const grouped: Record<string, PlanRow[]> = {};
    (data || []).forEach((row: any) => {
      const key = row.date;
      if (!grouped[key]) grouped[key] = [] as any;
      grouped[key].push(row as PlanRow);
    });
    setPlansByDate(grouped);
  };

  const loadTrainingDays = async () => {
    if (!user) return;
    try {
      // activity_level is expected to be a JSON array describing the weekly training plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('activity_level')
        .eq('user_id', user.id)
        .maybeSingle();

      const plan = profile?.activity_level ? JSON.parse(profile.activity_level as any) : null;
      const map: Record<string, boolean> = {};

      for (let i = 0; i < 7; i++) {
        const d = addDays(startDate, i);
        const dateStr = format(d, 'yyyy-MM-dd');
        if (Array.isArray(plan)) {
          const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
          const dayPlan = plan.find((w: any) => w && w.day === weekday);
          const hasTraining = !!(
            dayPlan &&
            dayPlan.activity &&
            dayPlan.activity !== 'rest' &&
            (dayPlan.estimatedCalories || dayPlan.distanceKm || dayPlan.duration)
          );
          map[dateStr] = !!hasTraining;
        } else {
          map[dateStr] = false;
        }
      }

      setTrainingDays(map);
    } catch (_) {
      setTrainingDays({});
    }
  };

  const generateWeek = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');

      // Try to generate the week without clearing existing rows.
      const session = (await supabase.auth.getSession()).data.session;
      const { error } = await supabase.functions.invoke('generate-meal-plan-range', {
        body: { startDate: startStr, weeks: 1 },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) throw error;

      await loadWeeklyPlans();
      toast({ title: 'Plans generated', description: '7-day meal plans created.' });
    } catch (e) {
      // Fallback: per-day generation to handle potential conflicts when rows exist
      try {
        const days: string[] = [];
        for (let i = 0; i < 7; i++) {
          days.push(format(addDays(startDate, i), 'yyyy-MM-dd'));
        }
        for (const day of days) {
          const session = (await supabase.auth.getSession()).data.session;
          try {
            await supabase.functions.invoke('generate-meal-plan', {
              body: { date: day },
              headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
            });
          } catch {}
        }
        await loadWeeklyPlans();
        toast({ title: 'Plans generated', description: 'Generated day-by-day successfully.' });
      } catch (err) {
        console.error('Failed to generate week', err);
        toast({ title: 'Generation failed', description: 'Could not generate plans.', variant: 'destructive' });
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-7xl mx-auto p-4">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background pb-20">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/meals')} className="mb-4 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meals
          </Button>
          <h1 className="text-2xl font-bold text-foreground mb-2">7-Day Meal Plans</h1>
          <p className="text-muted-foreground text-sm">Generated plans for the next 7 days</p>
        </div>

        {/* Week navigation + Generate */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStartDate(addDays(startDate, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {format(startDate, 'MMM dd')} - {format(addDays(startDate, 6), 'MMM dd')}
            </span>
            <Button variant="outline" size="sm" onClick={() => setStartDate(addDays(startDate, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate(`/shopping-list?start=${format(startDate, 'yyyy-MM-dd')}`)} variant="outline" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Shopping List
            </Button>
            <Button onClick={generateWeek} disabled={generating} className="flex items-center gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? 'Generating…' : 'Generate Week'}
            </Button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 7 }).map((_, idx) => {
            const date = addDays(startDate, idx);
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayPlans = plansByDate[dateStr] || [];

            const isTraining = !!trainingDays[dateStr];
            return (
              <Card key={dateStr} className={isTraining ? "shadow-card border bg-primary/5" : "shadow-card"}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(date, 'EEEE, MMM dd')}
                    </span>
                    {isTraining && (
                      <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                        Training day
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dayPlans.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No plan yet. Generate from Meals page.</div>
                  ) : (
                    ['breakfast','lunch','dinner','snack'].map((type) => {
                      const plan = dayPlans.find((p: any) => p.meal_type === type);
                      if (!plan) return null;
                      const first = Array.isArray(plan.meal_suggestions) && plan.meal_suggestions.length > 0 ? plan.meal_suggestions[0] : null;
                      return (
                        <div key={type} className="p-3 bg-muted/20 rounded border">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold capitalize">{type}</div>
                            <div className="text-xs text-muted-foreground">Target: {plan.recommended_calories} kcal</div>
                          </div>
                          {first ? (
                            <div className="text-sm">
                              <div className="font-medium text-primary">{first.name}</div>
                              <div className="text-muted-foreground">{first.description}</div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No suggestions.</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}


