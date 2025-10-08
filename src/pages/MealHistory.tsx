import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Utensils, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import { PageHeading } from '@/components/PageHeading';

interface FoodLog {
  id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  serving_size: string;
  logged_at: string;
}

interface DayData {
  date: string;
  logs: FoodLog[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export default function MealHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    return startOfWeek;
  });

  useEffect(() => {
    if (user) {
      loadWeekData();
    }
  }, [user, currentWeekStart]);

  const loadWeekData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const startDate = format(currentWeekStart, 'yyyy-MM-dd');
      const endDate = format(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

      const { data: logs } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${startDate}T00:00:00`)
        .lte('logged_at', `${endDate}T23:59:59`)
        .order('logged_at', { ascending: false });

      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(currentWeekStart.getDate() + i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const dayLogs = logs?.filter(log => 
          format(new Date(log.logged_at), 'yyyy-MM-dd') === dateStr
        ) || [];

        const totalCalories = dayLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
        const totalProtein = dayLogs.reduce((sum, log) => sum + (log.protein_grams || 0), 0);
        const totalCarbs = dayLogs.reduce((sum, log) => sum + (log.carbs_grams || 0), 0);
        const totalFat = dayLogs.reduce((sum, log) => sum + (log.fat_grams || 0), 0);

        days.push({
          date: dateStr,
          logs: dayLogs,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
        });
      }

      setWeekData(days);
    } catch (error) {
      console.error('Error loading week data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-background flex items-center justify-center pb-20">
          <div className="animate-pulse">
            <div className="w-12 h-12 bg-primary rounded-full"></div>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-none mx-auto p-4">
          {/* Header */}
          <div className="mb-2">
            <Button variant="ghost" onClick={() => navigate('/meals')} className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Meals
            </Button>
          </div>
          <PageHeading
            title="Meal History"
            description="Review logged meals and macro totals over time."
            className="mt-3"
          />

          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">This Week</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeekStart(subDays(currentWeekStart, 7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {format(currentWeekStart, 'MMM dd')} - {format(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM dd')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeekStart(subDays(currentWeekStart, -7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Week View */}
          <div className="space-y-4">
            {weekData.map((day) => (
              <Card key={day.date} className="shadow-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {format(new Date(day.date), 'EEEE, MMM dd')}
                    </CardTitle>
                    <div className="text-sm font-semibold">
                      {day.totalCalories} <span className="text-muted-foreground font-normal">cal</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Macros Summary */}
                  {day.logs.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 text-xs mb-3 p-3 bg-muted/30 rounded-lg">
                      <div className="text-center">
                        <div className="font-semibold text-success">{day.totalProtein}g</div>
                        <div className="text-muted-foreground">Protein</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-warning">{day.totalCarbs}g</div>
                        <div className="text-muted-foreground">Carbs</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-info">{day.totalFat}g</div>
                        <div className="text-muted-foreground">Fat</div>
                      </div>
                    </div>
                  )}

                  {/* Meals */}
                  {day.logs.length > 0 ? (
                    <div className="space-y-2">
                      {day.logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Utensils className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm capitalize">{log.meal_type}</div>
                              <div className="text-xs text-muted-foreground">{log.food_name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm">{log.calories} cal</div>
                            <div className="text-xs text-muted-foreground">
                              P:{log.protein_grams}g C:{log.carbs_grams}g F:{log.fat_grams}g
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      No meals logged for this day
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
