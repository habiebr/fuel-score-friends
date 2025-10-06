import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Coffee, Sun, Sunset, Moon, Zap, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface MealLog {
  id: string;
  food_name: string;
  calories: number;
  logged_at: string;
  meal_type?: string;
}

interface MealTimelineProps {
  className?: string;
}

const MEAL_PERIODS = [
  {
    type: 'breakfast',
    label: 'Breakfast',
    icon: Coffee,
    time: '6-10 AM',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    runTip: 'Pre-run: Light carbs 1-2 hours before',
  },
  {
    type: 'morning_snack',
    label: 'Mid-Morning',
    icon: Sun,
    time: '10-12 PM',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    runTip: 'Quick energy boost for morning runners',
  },
  {
    type: 'lunch',
    label: 'Lunch',
    icon: Sun,
    time: '12-2 PM',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    runTip: 'Balanced meal with protein + carbs',
  },
  {
    type: 'afternoon_snack',
    label: 'Afternoon',
    icon: Sunset,
    time: '2-5 PM',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    runTip: 'Pre-evening run fuel',
  },
  {
    type: 'dinner',
    label: 'Dinner',
    icon: Sunset,
    time: '6-8 PM',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    runTip: 'Post-run recovery meal',
  },
  {
    type: 'evening_snack',
    label: 'Evening',
    icon: Moon,
    time: '8-10 PM',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    runTip: 'Light protein for overnight recovery',
  },
];

export function MealTimeline({ className = '' }: MealTimelineProps) {
  const { user } = useAuth();
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadMealLogs();
    }
  }, [user]);

  const loadMealLogs = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('food_logs')
        .select('id, food_name, calories, logged_at, meal_type')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .order('logged_at', { ascending: true });

      setMealLogs(data || []);
    } catch (error) {
      console.error('Error loading meal logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMealPeriod = (hour: number): string => {
    if (hour >= 6 && hour < 10) return 'breakfast';
    if (hour >= 10 && hour < 12) return 'morning_snack';
    if (hour >= 12 && hour < 14) return 'lunch';
    if (hour >= 14 && hour < 17) return 'afternoon_snack';
    if (hour >= 17 && hour < 20) return 'dinner';
    return 'evening_snack';
  };

  const groupMealsByPeriod = () => {
    const grouped = new Map<string, MealLog[]>();
    
    mealLogs.forEach((log) => {
      const hour = new Date(log.logged_at).getHours();
      const period = log.meal_type || getMealPeriod(hour);
      
      if (!grouped.has(period)) {
        grouped.set(period, []);
      }
      grouped.get(period)!.push(log);
    });

    return grouped;
  };

  const groupedMeals = groupMealsByPeriod();
  const currentHour = new Date().getHours();
  const currentPeriod = getMealPeriod(currentHour);

  if (loading) {
    return (
      <Card className={`${className} bg-white dark:bg-gray-800`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Today's Meal Timeline
          </h3>
        </div>

        <div className="space-y-4">
          {MEAL_PERIODS.map((period) => {
            const Icon = period.icon;
            const meals = groupedMeals.get(period.type) || [];
            const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
            const isCurrentPeriod = period.type === currentPeriod;
            const hasLogged = meals.length > 0;

            return (
              <div
                key={period.type}
                className={`relative pl-8 pb-4 border-l-2 ${
                  hasLogged
                    ? 'border-green-500 dark:border-green-400'
                    : isCurrentPeriod
                    ? 'border-blue-500 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700'
                } last:border-0`}
              >
                {/* Timeline Dot */}
                <div className={`absolute left-0 top-0 -ml-2 w-4 h-4 rounded-full border-2 ${
                  hasLogged
                    ? 'bg-green-500 border-green-500 dark:bg-green-400 dark:border-green-400'
                    : isCurrentPeriod
                    ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400 animate-pulse'
                    : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600'
                }`}>
                  {hasLogged && (
                    <CheckCircle className="w-3 h-3 text-white absolute -top-[2px] -left-[2px]" />
                  )}
                </div>

                {/* Period Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${period.bg}`}>
                      <Icon className={`w-4 h-4 ${period.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {period.label}
                        </span>
                        {isCurrentPeriod && (
                          <Badge variant="secondary" className="text-xs">
                            Now
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {period.time}
                      </span>
                    </div>
                  </div>
                  {hasLogged && (
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {totalCalories} cal
                    </span>
                  )}
                </div>

                {/* Logged Meals */}
                {hasLogged ? (
                  <div className="space-y-1 ml-9">
                    {meals.map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2"
                      >
                        <span className="text-gray-700 dark:text-gray-300">
                          {meal.food_name}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          {meal.calories} cal
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ml-9">
                    <div className="flex items-start gap-2 text-sm">
                      <Zap className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-500 dark:text-gray-400 italic">
                        {period.runTip}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                Meals Logged
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {mealLogs.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                Total Calories
              </div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {mealLogs.reduce((sum, m) => sum + (m.calories || 0), 0)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

