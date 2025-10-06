import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock, Utensils } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FoodLog {
  id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  serving_size?: string;
  logged_at: string;
}

interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
}

interface WeekData {
  [date: string]: {
    logs: FoodLog[];
    totals: DayTotals;
    targets: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  };
}

export default function WeeklyFoodDiary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<WeekData>({});
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    if (user) {
      loadWeekData();
    }
  }, [user, currentWeekStart]);

  const loadWeekData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const start = format(currentWeekStart, 'yyyy-MM-dd');
      const end = format(endOfWeek(currentWeekStart), 'yyyy-MM-dd');

      // Load food logs
      const { data: logs, error: logsError } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${start}T00:00:00`)
        .lte('logged_at', `${end}T23:59:59`)
        .order('logged_at', { ascending: true });

      if (logsError) throw logsError;

      // Load nutrition scores for targets
      const { data: scores, error: scoresError } = await supabase
        .from('nutrition_scores')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);

      if (scoresError) throw scoresError;

      // Initialize week data structure
      const weekData: WeekData = {};
      for (let i = 0; i < 7; i++) {
        const date = format(addWeeks(currentWeekStart, i/7), 'yyyy-MM-dd');
        weekData[date] = {
          logs: [],
          totals: {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            meals: 0
          },
          targets: {
            calories: 2400, // Default targets
            protein: 120,
            carbs: 330,
            fat: 67
          }
        };
      }

      // Group logs by date
      (logs || []).forEach((log: FoodLog) => {
        const date = log.logged_at.split('T')[0];
        if (weekData[date]) {
          weekData[date].logs.push(log);
          weekData[date].totals.calories += log.calories || 0;
          weekData[date].totals.protein += log.protein_grams || 0;
          weekData[date].totals.carbs += log.carbs_grams || 0;
          weekData[date].totals.fat += log.fat_grams || 0;
          weekData[date].totals.meals += 1;
        }
      });

      // Add targets from nutrition scores
      (scores || []).forEach((score) => {
        if (weekData[score.date]) {
          weekData[score.date].targets = {
            calories: score.calories_consumed || 2400,
            protein: score.protein_grams || 120,
            carbs: score.carbs_grams || 330,
            fat: score.fat_grams || 67
          };
        }
      });

      setWeekData(weekData);

    } catch (error) {
      console.error('Error loading week data:', error);
      toast({
        title: 'Error loading food diary',
        description: 'Could not load your weekly food data.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => 
      direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
    );
  };

  const getMealIcon = (mealType: string) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast': return '🌅';
      case 'morning_snack': return '🥨';
      case 'lunch': return '🍱';
      case 'afternoon_snack': return '🍎';
      case 'dinner': return '🍽️';
      case 'evening_snack': return '🌙';
      default: return '🍽️';
    }
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 90 && percentage <= 110) return 'bg-green-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background p-4 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background p-4 pb-28">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Weekly Food Diary</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              {format(currentWeekStart, 'MMM d')} - {format(endOfWeek(currentWeekStart), 'MMM d, yyyy')}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek('next')}
              disabled={format(currentWeekStart, 'yyyy-MM-dd') === format(startOfWeek(new Date()), 'yyyy-MM-dd')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Week Overview */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {Object.entries(weekData).map(([date, data]) => (
          <Card key={date} className={`shadow-sm ${
            date === format(new Date(), 'yyyy-MM-dd') ? 'border-primary' : ''
          }`}>
            <CardContent className="p-2 text-center">
              <div className="text-xs font-medium mb-1">{format(new Date(date), 'EEE')}</div>
              <div className="text-sm font-bold mb-1">{format(new Date(date), 'd')}</div>
              <div className="text-xs text-muted-foreground">{data.totals.calories} kcal</div>
              <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(data.totals.calories, data.targets.calories)}`}
                  style={{ width: `${Math.min(100, (data.totals.calories / data.targets.calories) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Daily Logs */}
      <div className="space-y-4">
        {Object.entries(weekData).map(([date, data]) => (
          <Card key={date} className={date === format(new Date(), 'yyyy-MM-dd') ? 'border-primary' : ''}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {format(new Date(date), 'EEEE, MMMM d')}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {data.totals.meals} meals
                  </Badge>
                  <Badge variant="secondary">
                    {data.totals.calories} / {data.targets.calories} kcal
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Macro Progress */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-sm font-medium mb-1">Protein</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {data.totals.protein}g
                  </div>
                  <div className="text-xs text-muted-foreground">
                    of {data.targets.protein}g
                  </div>
                  <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, (data.totals.protein / data.targets.protein) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium mb-1">Carbs</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {data.totals.carbs}g
                  </div>
                  <div className="text-xs text-muted-foreground">
                    of {data.targets.carbs}g
                  </div>
                  <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${Math.min(100, (data.totals.carbs / data.targets.carbs) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium mb-1">Fat</div>
                  <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                    {data.totals.fat}g
                  </div>
                  <div className="text-xs text-muted-foreground">
                    of {data.targets.fat}g
                  </div>
                  <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{ width: `${Math.min(100, (data.totals.fat / data.targets.fat) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Meal Logs */}
              <div className="space-y-2">
                {data.logs.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Utensils className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No meals logged</p>
                  </div>
                ) : (
                  data.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="text-2xl">{getMealIcon(log.meal_type)}</div>
                      <div className="flex-1">
                        <div className="font-medium">{log.food_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(log.logged_at), 'h:mm a')}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{log.meal_type.replace('_', ' ')}</span>
                          {log.serving_size && (
                            <>
                              <span>•</span>
                              <span>{log.serving_size}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{log.calories} kcal</div>
                        <div className="text-xs text-muted-foreground">
                          P: {log.protein_grams}g • C: {log.carbs_grams}g • F: {log.fat_grams}g
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
