import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, startOfDay } from 'date-fns';
import { accumulateConsumedFromFoodLogs } from '@/lib/nutrition';

interface DayData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface WeeklyNutritionTrendsProps {
  className?: string;
}

export function WeeklyNutritionTrends({ className = '' }: WeeklyNutritionTrendsProps) {
  const { user } = useAuth();
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<'calories' | 'protein' | 'carbs' | 'fat'>('calories');

  useEffect(() => {
    if (user) {
      loadWeeklyData();
    }
  }, [user]);

  const loadWeeklyData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const weekAgo = subDays(today, 6);

      const { data: foodLogs } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', weekAgo.toISOString())
        .lte('logged_at', new Date().toISOString());

      // Group by date
      const dateMap = new Map<string, any[]>();
      (foodLogs || []).forEach((log) => {
        const date = format(new Date(log.logged_at), 'yyyy-MM-dd');
        if (!dateMap.has(date)) {
          dateMap.set(date, []);
        }
        dateMap.get(date)!.push(log);
      });

      // Create day data for last 7 days
      const days: DayData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), 'yyyy-MM-dd');
        const logs = dateMap.get(date) || [];
        const nutrition = accumulateConsumedFromFoodLogs(logs);

        days.push({
          date,
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
        });
      }

      setWeekData(days);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={`${className} bg-white dark:bg-gray-800`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const metricConfig = {
    calories: { label: 'Calories', color: 'bg-orange-500', unit: 'cal', max: 3000 },
    protein: { label: 'Protein', color: 'bg-red-500', unit: 'g', max: 200 },
    carbs: { label: 'Carbs', color: 'bg-amber-500', unit: 'g', max: 400 },
    fat: { label: 'Fat', color: 'bg-blue-500', unit: 'g', max: 100 },
  };

  const config = metricConfig[activeMetric];
  const maxValue = Math.max(...weekData.map((d) => d[activeMetric]), config.max);

  // Calculate trend
  const firstHalf = weekData.slice(0, 3).reduce((sum, d) => sum + d[activeMetric], 0) / 3;
  const secondHalf = weekData.slice(4, 7).reduce((sum, d) => sum + d[activeMetric], 0) / 3;
  const trend = secondHalf - firstHalf;
  const trendPercent = firstHalf > 0 ? (trend / firstHalf) * 100 : 0;

  return (
    <Card className={`${className} bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Weekly Trends
            </h3>
          </div>
          {trend !== 0 && (
            <Badge
              variant="secondary"
              className={`${
                trend > 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              }`}
            >
              {trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(trendPercent).toFixed(0)}%
            </Badge>
          )}
        </div>

        {/* Metric Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map((metric) => (
            <button
              key={metric}
              onClick={() => setActiveMetric(metric)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activeMetric === metric
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {metricConfig[metric].label}
            </button>
          ))}
        </div>

        {/* Bar Chart */}
        <div className="space-y-3">
          {weekData.map((day, index) => {
            const value = day[activeMetric];
            const percentage = (value / maxValue) * 100;
            const isToday = index === weekData.length - 1;
            const dayLabel = format(new Date(day.date), 'EEE');

            return (
              <div key={day.date} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${isToday ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {dayLabel}
                    {isToday && <span className="ml-1 text-orange-500">●</span>}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 font-medium">
                    {Math.round(value)} {config.unit}
                  </span>
                </div>
                <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${config.color} transition-all duration-700 ease-out rounded-full flex items-center justify-end pr-2`}
                    style={{ width: `${percentage}%` }}
                  >
                    {percentage > 15 && (
                      <span className="text-xs font-medium text-white">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                Average
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {Math.round(weekData.reduce((sum, d) => sum + d[activeMetric], 0) / 7)}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{config.unit}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                Highest
              </div>
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {Math.round(Math.max(...weekData.map((d) => d[activeMetric])))}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{config.unit}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                Lowest
              </div>
              <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                {Math.round(Math.min(...weekData.map((d) => d[activeMetric])))}
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{config.unit}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

