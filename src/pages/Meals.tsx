import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { Calendar, Search, ArrowLeft, Utensils, TrendingUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';

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

export default function Meals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [weekData, setWeekData] = useState<DayData[]>([]);

  useEffect(() => {
    if (user) {
      loadWeekData();
    }
  }, [user]);

  const loadWeekData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, 6);

      const { data: logs, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', startDate.toISOString())
        .lte('logged_at', endDate.toISOString())
        .order('logged_at', { ascending: false });

      if (error) throw error;

      // Group by date
      const groupedByDate: { [key: string]: FoodLog[] } = {};
      logs?.forEach((log) => {
        const dateKey = format(new Date(log.logged_at), 'yyyy-MM-dd');
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(log);
      });

      // Create day data for last 7 days
      const daysData: DayData[] = [];
      for (let i = 0; i < 7; i++) {
        const date = format(subDays(endDate, i), 'yyyy-MM-dd');
        const dayLogs = groupedByDate[date] || [];
        daysData.push({
          date,
          logs: dayLogs,
          totalCalories: dayLogs.reduce((sum, log) => sum + log.calories, 0),
          totalProtein: dayLogs.reduce((sum, log) => sum + log.protein_grams, 0),
          totalCarbs: dayLogs.reduce((sum, log) => sum + log.carbs_grams, 0),
          totalFat: dayLogs.reduce((sum, log) => sum + log.fat_grams, 0),
        });
      }

      setWeekData(daysData);
    } catch (error) {
      console.error('Error loading week data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load meal history',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchFood = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('nutrition-ai', {
        body: {
          type: 'food_search',
          query: searchQuery,
        },
      });

      if (error) throw error;

      if (data.nutritionData) {
        setSearchResults(data.nutritionData);
        toast({
          title: 'Food found!',
          description: `Nutrition info retrieved for ${data.nutritionData.food_name}`,
        });
      }
    } catch (error) {
      console.error('Error searching food:', error);
      toast({
        title: 'Search failed',
        description: 'Failed to find food. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
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
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <div className="min-h-screen bg-gradient-background pb-20">
        <div className="max-w-7xl mx-auto p-4">
          {/* Header */}
          <div className="mb-6">
            <Button variant="ghost" onClick={() => navigate('/')} className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground mb-2">Meal Diary</h1>
            <p className="text-muted-foreground text-sm">Track your nutrition and search for foods</p>
          </div>

          {/* AI Food Search */}
          <Card className="shadow-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                AI Food Search
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for any food (e.g., banana, chicken breast)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchFood()}
                />
                <Button onClick={handleSearchFood} disabled={searching || !searchQuery.trim()}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchResults && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="font-semibold mb-2">{searchResults.food_name}</div>
                  <div className="text-sm text-muted-foreground mb-3">Serving: {searchResults.serving_size}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-semibold">{searchResults.calories}</span>
                      <span className="text-muted-foreground"> cal</span>
                    </div>
                    <div>
                      <span className="font-semibold text-success">{searchResults.protein_grams}g</span>
                      <span className="text-muted-foreground"> protein</span>
                    </div>
                    <div>
                      <span className="font-semibold text-warning">{searchResults.carbs_grams}g</span>
                      <span className="text-muted-foreground"> carbs</span>
                    </div>
                    <div>
                      <span className="font-semibold text-info">{searchResults.fat_grams}g</span>
                      <span className="text-muted-foreground"> fat</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Week Overview */}
          <div className="space-y-4">
            {weekData.map((day) => (
              <Card key={day.date} className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Calendar className="h-4 w-4 text-primary" />
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
      <BottomNav onAddMeal={() => setFoodTrackerOpen(true)} />
    </>
  );
}
