import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, Target, Users, Zap, TrendingUp, Clock } from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';

interface MealSuggestion {
  name: string;
  foods: string[];
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealPlan {
  meal_type: string;
  recommended_calories: number;
  recommended_protein_grams: number;
  recommended_carbs_grams: number;
  recommended_fat_grams: number;
  meal_suggestions: MealSuggestion[];
  meal_score: number | null;
}

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
  plannedCalories: number;
  plannedProtein: number;
  plannedCarbs: number;
  plannedFat: number;
  breakfastScore: number | null;
  lunchScore: number | null;
  dinnerScore: number | null;
}

interface DashboardProps {
  onAddMeal?: () => void;
}

export function Dashboard({ onAddMeal }: DashboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [raceGoal, setRaceGoal] = useState<string>('');
  const [targetMonths, setTargetMonths] = useState<string>('');
  const [raceDate, setRaceDate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (user) {
      loadDashboardData();
      generateDailyMealPlan();
      loadGoals();
    }
  }, [user]);

  // Countdown timer effect
  useEffect(() => {
    if (!raceDate) return;

    const updateCountdown = () => {
      const now = new Date();
      const target = new Date(raceDate);
      
      if (target <= now) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const totalSeconds = differenceInSeconds(target, now);
      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = differenceInHours(target, now) % 24;
      const minutes = differenceInMinutes(target, now) % 60;
      const seconds = differenceInSeconds(target, now) % 60;

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [raceDate]);

  const loadGoals = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('fitness_goals, activity_level')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile && profile.fitness_goals && profile.fitness_goals.length > 0) {
        const goalName = profile.fitness_goals[0];
        setRaceGoal(goalName);

        // Try to find the marathon event matching this goal
        const { data: marathonEvent } = await supabase
          .from('marathon_events')
          .select('event_date, event_name')
          .ilike('event_name', `%${goalName}%`)
          .maybeSingle();

        if (marathonEvent) {
          setRaceDate(new Date(marathonEvent.event_date));
        }
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const generateDailyMealPlan = async () => {
    if (!user) return;
    
    setGeneratingPlan(true);
    try {
      const { error } = await supabase.functions.invoke('generate-meal-plan', {
        body: { date: format(new Date(), 'yyyy-MM-dd') }
      });
      
      if (error) {
        console.error('Error generating meal plan:', error);
      }
    } catch (error) {
      console.error('Error invoking meal plan function:', error);
    } finally {
      setGeneratingPlan(false);
    }
  };

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

      // Fetch meal plans for today
      const { data: plans } = await supabase
        .from('daily_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);

      if (plans) {
        setMealPlans(plans.map(plan => ({
          ...plan,
          meal_suggestions: (plan.meal_suggestions as unknown as MealSuggestion[]) || []
        })));
      }

      // Calculate planned nutrition from meal plans
      const plannedNutrition = plans?.reduce(
        (acc, plan) => ({
          calories: acc.calories + (plan.recommended_calories || 0),
          protein: acc.protein + (plan.recommended_protein_grams || 0),
          carbs: acc.carbs + (plan.recommended_carbs_grams || 0),
          fat: acc.fat + (plan.recommended_fat_grams || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

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
        plannedCalories: plannedNutrition.calories,
        plannedProtein: plannedNutrition.protein,
        plannedCarbs: plannedNutrition.carbs,
        plannedFat: plannedNutrition.fat,
        breakfastScore: nutritionScore?.breakfast_score || null,
        lunchScore: nutritionScore?.lunch_score || null,
        dinnerScore: nutritionScore?.dinner_score || null,
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

        {/* Race Goals Widget */}
        {raceGoal && (
          <Card className="shadow-card mb-6 bg-gradient-to-br from-primary/5 to-primary-glow/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Race Goal</span>
                  </div>
                  <div className="text-lg font-bold text-primary capitalize">
                    {raceGoal.replace('_', ' ')}
                  </div>
                  {targetMonths && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Target: {targetMonths} months
                    </div>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/goals')}
                  className="text-primary hover:text-primary-glow"
                >
                  Update
                </Button>
              </div>

              {/* Countdown Timer */}
              {countdown && raceDate && (
                <div className="pt-3 border-t border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Time until race:
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.days}
                      </div>
                      <div className="text-xs text-muted-foreground">Days</div>
                    </div>
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.hours}
                      </div>
                      <div className="text-xs text-muted-foreground">Hours</div>
                    </div>
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.minutes}
                      </div>
                      <div className="text-xs text-muted-foreground">Mins</div>
                    </div>
                    <div className="text-center bg-primary/10 rounded-lg p-2">
                      <div className="text-xl font-bold text-primary">
                        {countdown.seconds}
                      </div>
                      <div className="text-xs text-muted-foreground">Secs</div>
                    </div>
                  </div>
                  <div className="text-xs text-center text-muted-foreground mt-2">
                    Race date: {format(raceDate, 'MMM dd, yyyy')}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Today's Nutrition - Priority Section */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Target className="h-5 w-5 text-primary" />
                Today's Nutrition Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Calories Progress */}
              <div className="bg-muted/30 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Daily Calories</span>
                  <span className="text-sm text-muted-foreground">
                    {data?.caloriesConsumed || 0} / {data?.plannedCalories || 0}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: `${Math.min(100, ((data?.caloriesConsumed || 0) / (data?.plannedCalories || 1)) * 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* Macros Grid - Mobile Optimized */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-success/10 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-success">
                    {data?.proteinGrams || 0}g
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Protein ({data?.plannedProtein || 0}g)
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-warning/10 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-warning">
                    {data?.carbsGrams || 0}g
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Carbs ({data?.plannedCarbs || 0}g)
                  </div>
                </div>
                <div className="text-center p-3 sm:p-4 bg-info/10 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-info">
                    {data?.fatGrams || 0}g
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    Fat ({data?.plannedFat || 0}g)
                  </div>
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
                  {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                    const plan = mealPlans.find(p => p.meal_type === mealType);
                    const score = mealType === 'breakfast' ? data?.breakfastScore 
                      : mealType === 'lunch' ? data?.lunchScore 
                      : data?.dinnerScore;
                    
                    return (
                      <div key={mealType} className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-sm capitalize">{mealType}</div>
                            {plan && (
                              <div className="text-xs text-muted-foreground">
                                {plan.recommended_calories} kcal target
                              </div>
                            )}
                          </div>
                          {score !== null && (
                            <div className={`text-xs font-medium px-2 py-1 rounded ${
                              score >= 80 ? 'bg-success/20 text-success' :
                              score >= 60 ? 'bg-warning/20 text-warning' :
                              'bg-destructive/20 text-destructive'
                            }`}>
                              Score: {score}
                            </div>
                          )}
                        </div>
                        {plan && plan.meal_suggestions && Array.isArray(plan.meal_suggestions) && plan.meal_suggestions.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-border pt-2">
                            <div className="text-xs font-medium text-primary">
                              💡 {(plan.meal_suggestions[0] as { name: string }).name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(plan.meal_suggestions[0] as { description: string }).description}
                            </div>
                            {(plan.meal_suggestions[0] as { foods: string[] }).foods && (
                              <div className="text-xs text-muted-foreground">
                                📋 {(plan.meal_suggestions[0] as { foods: string[] }).foods.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                        {(!plan || !plan.meal_suggestions || plan.meal_suggestions.length === 0) && (
                          <div className="text-xs text-muted-foreground mt-2 italic">
                            Click "Generate Plan" above to see meal suggestions
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/meals')}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Meal Diary
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/profile')}
              >
                <Target className="h-4 w-4 mr-2" />
                Profile & Goals
              </Button>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}