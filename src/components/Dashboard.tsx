import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, Target, Users, Zap } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-background p-3 sm:p-4 pb-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Good morning! 👋
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>

        {/* Daily Score - Hero Section */}
        <div className="mb-6">
          <ScoreCard
            title="Daily Score"
            score={data?.dailyScore || 0}
            maxScore={100}
            subtitle="Keep it up!"
            variant="success"
            className="animate-fade-in"
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
              
              {/* AI Suggestions */}
              <div className="bg-gradient-primary/10 rounded-lg p-4 border border-primary/20">
                <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  AI Suggestion
                </h4>
                <p className="text-sm text-muted-foreground">
                  💡 Based on your activity, try adding more protein to your next meal.
                </p>
              </div>
              
              {/* Leaderboard Position */}
              <div className="bg-secondary/10 rounded-lg p-4 border border-secondary/20">
                <h4 className="font-semibold mb-2 text-secondary flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Community
                </h4>
                <p className="text-sm text-muted-foreground">
                  🏆 You are #3 in this week's leaderboard
                </p>
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

        </div>

      </div>
    </div>
  );
}