import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, Plus, Target, Users, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardData {
  dailyScore: number;
  caloriesConsumed: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  mealsLogged: number;
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch nutrition score for today
      const { data: nutritionScore } = await supabase
        .from('nutrition_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      // Fetch wearable data for today
      const { data: wearableData } = await supabase
        .from('wearable_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      setData({
        dailyScore: nutritionScore?.daily_score || 0,
        caloriesConsumed: nutritionScore?.calories_consumed || 0,
        proteinGrams: nutritionScore?.protein_grams || 0,
        carbsGrams: nutritionScore?.carbs_grams || 0,
        fatGrams: nutritionScore?.fat_grams || 0,
        mealsLogged: nutritionScore?.meals_logged || 0,
        steps: wearableData?.steps || 0,
        caloriesBurned: wearableData?.calories_burned || 0,
        activeMinutes: wearableData?.active_minutes || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-primary rounded-full animate-pulse-glow"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background p-3 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Mobile-First Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Good morning! 👋
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {format(new Date(), 'EEEE, MMMM do')}
              </p>
            </div>
            <Button size="lg" className="shadow-button w-full sm:w-auto">
              <Plus className="h-5 w-5 mr-2" />
              Log Meal
            </Button>
          </div>
        </div>

        {/* Mobile-Optimized Score Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <ScoreCard
            title="Daily Score"
            score={data?.dailyScore || 0}
            maxScore={100}
            subtitle="Keep it up!"
            variant="success"
            className="animate-fade-in col-span-2 sm:col-span-1"
          />
          <ScoreCard
            title="Calories"
            score={data?.caloriesConsumed || 0}
            maxScore={2000}
            subtitle="kcal today"
            variant="warning"
            className="animate-fade-in"
          />
          <ScoreCard
            title="Meals"
            score={data?.mealsLogged || 0}
            maxScore={4}
            subtitle="logged"
            variant="info"
            className="animate-fade-in"
          />
          <ScoreCard
            title="Steps"
            score={data?.steps || 0}
            maxScore={10000}
            subtitle="today"
            variant="success"
            className="animate-fade-in col-span-2 sm:col-span-1"
          />
        </div>

        {/* Mobile-First Main Content */}
        <div className="space-y-4 sm:space-y-6">
          {/* Today's Nutrition - Priority Section */}
          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Target className="h-5 w-5 text-primary" />
                Today's Nutrition Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Macros Grid - Mobile Optimized */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-success/10 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-success">
                    {data?.proteinGrams || 0}g
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Protein</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-warning/10 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-warning">
                    {data?.carbsGrams || 0}g
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Carbs</div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-info/10 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-info">
                    {data?.fatGrams || 0}g
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Fat</div>
                </div>
              </div>
              
              {/* AI Suggestions - Mobile Priority */}
              <div className="bg-gradient-primary/10 rounded-lg p-4 border border-primary/20">
                <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  AI Nutrition Coach
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  💡 Based on your activity level, try adding more protein to your next meal. 
                  Consider lean chicken, fish, or plant-based options like lentils.
                </p>
                <Button variant="health" size="sm" className="w-full sm:w-auto">
                  Get Personalized Plan
                </Button>
              </div>

              {/* Meal Timeline */}
              <div className="mt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Today's Meal Schedule
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Breakfast</div>
                      <div className="text-xs text-muted-foreground">8:00 AM</div>
                    </div>
                    <div className="text-xs text-success font-medium">✓ Logged</div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Lunch</div>
                      <div className="text-xs text-muted-foreground">12:30 PM</div>
                    </div>
                    <div className="text-xs text-warning font-medium">⏰ Coming up</div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">Dinner</div>
                      <div className="text-xs text-muted-foreground">7:00 PM</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Planned</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Secondary Content Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Activity Card */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-secondary" />
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Calories Burned</span>
                  <span className="font-semibold">{data?.caloriesBurned || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Active Minutes</span>
                  <span className="font-semibold">{data?.activeMinutes || 0}</span>
                </div>
                <Button variant="secondary" size="sm" className="w-full">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  View Weekly Stats
                </Button>
              </CardContent>
            </Card>

            {/* Community Card */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-accent" />
                  Community
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  Weekly Leaderboard
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>🥇 Sarah M.</span>
                    <span className="font-semibold">425 pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>🥈 Alex K.</span>
                    <span className="font-semibold">389 pts</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>🥉 You</span>
                    <span className="font-semibold">{(data?.dailyScore || 0) * 7} pts</span>
                  </div>
                </div>
                <Button variant="health" size="sm" className="w-full">
                  View Full Leaderboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}