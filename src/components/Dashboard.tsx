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
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Good morning! 👋
              </h1>
              <p className="text-muted-foreground mt-1">
                {format(new Date(), 'EEEE, MMMM do')}
              </p>
            </div>
            <Button size="lg" className="shadow-button">
              <Plus className="h-5 w-5 mr-2" />
              Log Meal
            </Button>
          </div>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <ScoreCard
            title="Daily Score"
            score={data?.dailyScore || 0}
            maxScore={100}
            subtitle="Keep it up!"
            variant="success"
            className="animate-fade-in"
          />
          <ScoreCard
            title="Calories Today"
            score={data?.caloriesConsumed || 0}
            maxScore={2000}
            subtitle="kcal consumed"
            variant="warning"
            className="animate-fade-in"
          />
          <ScoreCard
            title="Meals Logged"
            score={data?.mealsLogged || 0}
            maxScore={4}
            subtitle="out of 4 planned"
            variant="info"
            className="animate-fade-in"
          />
          <ScoreCard
            title="Steps Today"
            score={data?.steps || 0}
            maxScore={10000}
            subtitle="from your wearable"
            variant="success"
            className="animate-fade-in"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Nutrition Overview */}
          <Card className="lg:col-span-2 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Today's Nutrition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <div className="text-2xl font-bold text-success">
                    {data?.proteinGrams || 0}g
                  </div>
                  <div className="text-sm text-muted-foreground">Protein</div>
                </div>
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <div className="text-2xl font-bold text-warning">
                    {data?.carbsGrams || 0}g
                  </div>
                  <div className="text-sm text-muted-foreground">Carbs</div>
                </div>
                <div className="text-center p-4 bg-info/10 rounded-lg">
                  <div className="text-2xl font-bold text-info">
                    {data?.fatGrams || 0}g
                  </div>
                  <div className="text-sm text-muted-foreground">Fat</div>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="font-semibold mb-3">AI Nutrition Suggestions</h4>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    💡 Based on your activity level, try adding more protein to your next meal. 
                    Consider lean chicken, fish, or plant-based options like lentils.
                  </p>
                  <Button variant="health" size="sm" className="mt-3">
                    Get Personalized Plan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity & Community */}
          <div className="space-y-6">
            {/* Activity Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-secondary" />
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                </div>
              </CardContent>
            </Card>

            {/* Community Card */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent" />
                  Community
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}