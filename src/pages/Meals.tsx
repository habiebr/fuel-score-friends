import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { 
  BookOpen, 
  Utensils, 
  Activity,
  Coffee,
  Moon,
  Apple,
  Zap,
  Award,
  Clock
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  Recipe,
  RecipeScore,
  UserPreferences,
  recommendRecipesForMeal,
  calculateBMR,
  getActivityFactor
} from '@/lib/nutrition-engine';

interface FoodLog {
  id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  logged_at: string;
}

type Tab = 'diary' | 'suggestions' | 'training';
type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre-run' | 'post-run' | 'race-day';

export default function Meals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('diary');
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [fitnessScreenshotOpen, setFitnessScreenshotOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Diary tab state
  const [todayLogs, setTodayLogs] = useState<FoodLog[]>([]);
  const [todayTotals, setTodayTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });
  const [targets, setTargets] = useState({
    calories: 2400,
    protein: 120,
    carbs: 330,
    fat: 67
  });
  
  // Suggestions tab state
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recommendedRecipes, setRecommendedRecipes] = useState<RecipeScore[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    dietary_restrictions: [],
    eating_behaviors: [],
    time_budget_min: 60
  });

  useEffect(() => {
    if (user) {
      loadDiaryData();
      loadUserPreferences();
      loadRecipes();
    }
  }, [user]);

  // Recalculate recommendations when filter or preferences change
  useEffect(() => {
    if (recipes.length > 0 && userPreferences) {
      generateRecommendations();
    }
  }, [mealFilter, recipes, userPreferences]);

  const loadDiaryData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Load today's food logs
      const { data: logs } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`)
        .order('logged_at', { ascending: false });

      setTodayLogs(logs || []);

      // Calculate totals
      const totals = (logs || []).reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein_grams || 0),
        carbs: acc.carbs + (log.carbs_grams || 0),
        fat: acc.fat + (log.fat_grams || 0)
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      setTodayTotals(totals);

      // Load user's nutrition targets from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('weight_kg, height_cm, age, sex')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        // Calculate BMR using Mifflin-St Jeor equation
        const { weight_kg, height_cm, age, sex } = profile;
        let bmr = 0;
        if (sex === 'male') {
          bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5;
        } else {
          bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161;
        }
        
        // Activity multiplier for runners (moderate-high)
        const tdee = Math.round(bmr * 1.6);
        
        // Macro targets for runners (40% carbs, 30% protein, 30% fat)
        setTargets({
          calories: tdee,
          protein: Math.round((tdee * 0.30) / 4), // 4 cal/g
          carbs: Math.round((tdee * 0.40) / 4),
          fat: Math.round((tdee * 0.30) / 9) // 9 cal/g
        });
      }
    } catch (error) {
      console.error('Error loading diary data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserPreferences = async () => {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('dietary_restrictions, eating_behaviors')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setUserPreferences({
          dietary_restrictions: profile.dietary_restrictions || [],
          eating_behaviors: profile.eating_behaviors || [],
          time_budget_min: 60
        });
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const generateRecommendations = () => {
    if (recipes.length === 0) return;

    // Get meal target based on filter
    let mealTarget = {
      kcal: targets.calories / 3,
      cho_g: targets.carbs / 3,
      protein_g: targets.protein / 3,
      fat_g: targets.fat / 3
    };

    // Adjust for meal type
    if (mealFilter === 'breakfast') {
      mealTarget.kcal = targets.calories * 0.25;
      mealTarget.cho_g = targets.carbs * 0.25;
      mealTarget.protein_g = targets.protein * 0.25;
      mealTarget.fat_g = targets.fat * 0.25;
    } else if (mealFilter === 'lunch') {
      mealTarget.kcal = targets.calories * 0.35;
      mealTarget.cho_g = targets.carbs * 0.35;
      mealTarget.protein_g = targets.protein * 0.35;
      mealTarget.fat_g = targets.fat * 0.35;
    } else if (mealFilter === 'dinner') {
      mealTarget.kcal = targets.calories * 0.30;
      mealTarget.cho_g = targets.carbs * 0.30;
      mealTarget.protein_g = targets.protein * 0.30;
      mealTarget.fat_g = targets.fat * 0.30;
    } else if (mealFilter === 'snack' || mealFilter === 'pre-run' || mealFilter === 'post-run') {
      mealTarget.kcal = targets.calories * 0.10;
      mealTarget.cho_g = targets.carbs * 0.15;
      mealTarget.protein_g = targets.protein * 0.10;
      mealTarget.fat_g = targets.fat * 0.05;
    }

    // Use the recommendation engine
    const recommendations = recommendRecipesForMeal(
      recipes,
      mealTarget,
      mealFilter === 'all' ? 'breakfast' : mealFilter as any,
      userPreferences,
      20 // Top 20 recipes
    );

    setRecommendedRecipes(recommendations);
  };

  const loadRecipes = async () => {
    // Recipe database - matches nutrition-engine.ts Recipe interface
    const mockRecipes: Recipe[] = [
      {
        id: '1',
        name: 'Overnight Oats with Berries',
        nutrients_per_serving: { calories: 380, cho_g: 58, protein_g: 12, fat_g: 8 },
        prep_time: 5,
        cost_est: 3,
        tags: ['breakfast', 'easy', 'pre-run', 'high-fiber', 'oatmeal'],
        ingredients: ['rolled oats', 'Greek yogurt', 'chia seeds', 'mixed berries']
      },
      {
        id: '2',
        name: 'Banana with Almond Butter',
        nutrients_per_serving: { calories: 190, cho_g: 32, protein_g: 6, fat_g: 8 },
        prep_time: 2,
        cost_est: 2,
        tags: ['snack', 'pre-run', 'easy', 'quick'],
        ingredients: ['banana', 'almond butter']
      },
      {
        id: '3',
        name: 'Grilled Chicken with Sweet Potato',
        nutrients_per_serving: { calories: 520, cho_g: 52, protein_g: 45, fat_g: 12 },
        prep_time: 30,
        cost_est: 7,
        tags: ['lunch', 'dinner', 'post-run', 'high-protein', 'recovery'],
        ingredients: ['chicken breast', 'sweet potato', 'broccoli', 'olive oil']
      },
      {
        id: '4',
        name: 'Recovery Smoothie',
        nutrients_per_serving: { calories: 340, cho_g: 42, protein_g: 28, fat_g: 6 },
        prep_time: 5,
        cost_est: 4,
        tags: ['snack', 'post-run', 'easy', 'protein shake', 'recovery'],
        ingredients: ['banana', 'protein powder', 'Greek yogurt', 'berries', 'almond milk']
      },
      {
        id: '5',
        name: 'Race Day Pasta',
        nutrients_per_serving: { calories: 680, cho_g: 95, protein_g: 38, fat_g: 14 },
        prep_time: 25,
        cost_est: 6,
        tags: ['dinner', 'race-day', 'high-carb', 'pasta'],
        ingredients: ['whole grain pasta', 'marinara sauce', 'turkey meatballs']
      },
      {
        id: '6',
        name: 'Scrambled Eggs with Avocado Toast',
        nutrients_per_serving: { calories: 420, cho_g: 35, protein_g: 22, fat_g: 20 },
        prep_time: 10,
        cost_est: 4,
        tags: ['breakfast', 'eggs', 'easy', 'high-protein'],
        ingredients: ['eggs', 'whole grain bread', 'avocado', 'salt', 'pepper']
      },
      {
        id: '7',
        name: 'Salmon with Quinoa and Vegetables',
        nutrients_per_serving: { calories: 580, cho_g: 48, protein_g: 42, fat_g: 22 },
        prep_time: 35,
        cost_est: 10,
        tags: ['lunch', 'dinner', 'fish', 'omega-3', 'high-protein'],
        ingredients: ['salmon fillet', 'quinoa', 'mixed vegetables', 'lemon']
      },
      {
        id: '8',
        name: 'Greek Yogurt Parfait',
        nutrients_per_serving: { calories: 280, cho_g: 38, protein_g: 18, fat_g: 6 },
        prep_time: 5,
        cost_est: 3,
        tags: ['breakfast', 'snack', 'easy', 'yogurt', 'quick'],
        ingredients: ['Greek yogurt', 'granola', 'honey', 'berries']
      },
      {
        id: '9',
        name: 'Turkey and Hummus Wrap',
        nutrients_per_serving: { calories: 390, cho_g: 42, protein_g: 28, fat_g: 12 },
        prep_time: 5,
        cost_est: 5,
        tags: ['lunch', 'easy', 'quick', 'high-protein'],
        ingredients: ['whole wheat wrap', 'turkey breast', 'hummus', 'lettuce', 'tomato']
      },
      {
        id: '10',
        name: 'Plant-Based Protein Bowl',
        nutrients_per_serving: { calories: 460, cho_g: 58, protein_g: 24, fat_g: 14 },
        prep_time: 20,
        cost_est: 6,
        tags: ['lunch', 'dinner', 'vegan', 'plant-based', 'high-protein'],
        ingredients: ['chickpeas', 'brown rice', 'tahini', 'vegetables', 'quinoa']
      },
      {
        id: '11',
        name: 'Energy Balls',
        nutrients_per_serving: { calories: 150, cho_g: 22, protein_g: 5, fat_g: 6 },
        prep_time: 15,
        cost_est: 2,
        tags: ['snack', 'pre-run', 'easy', 'oatmeal', 'dates'],
        ingredients: ['dates', 'oats', 'peanut butter', 'chia seeds']
      },
      {
        id: '12',
        name: 'Chicken Stir-Fry',
        nutrients_per_serving: { calories: 480, cho_g: 45, protein_g: 38, fat_g: 16 },
        prep_time: 25,
        cost_est: 7,
        tags: ['dinner', 'lunch', 'high-protein', 'chicken'],
        ingredients: ['chicken breast', 'mixed vegetables', 'soy sauce', 'brown rice']
      }
    ];

    setRecipes(mockRecipes);
  };

  const getCompatibilityColor = (compatibility: 'excellent' | 'good' | 'fair' | 'incompatible') => {
    switch (compatibility) {
      case 'excellent': return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400';
      case 'good': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400';
      case 'fair': return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400';
      case 'incompatible': return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400';
    }
  };

  const getMealTypeIcon = (type: MealFilter) => {
    switch (type) {
      case 'breakfast': return <Coffee className="w-4 h-4" />;
      case 'lunch': return <Utensils className="w-4 h-4" />;
      case 'dinner': return <Moon className="w-4 h-4" />;
      case 'snack': return <Apple className="w-4 h-4" />;
      case 'pre-run': return <Zap className="w-4 h-4" />;
      case 'post-run': return <Award className="w-4 h-4" />;
      case 'race-day': return <Activity className="w-4 h-4" />;
      default: return null;
    }
  };

  const getMealScore = (mealType: string) => {
    const mealLogs = todayLogs.filter(log => log.meal_type === mealType);
    if (mealLogs.length === 0) return 0;
    // Simple scoring: based on whether it fits within target ranges
    const totalCal = mealLogs.reduce((sum, log) => sum + log.calories, 0);
    const targetCal = targets.calories / 3; // Rough estimate for one meal
    return Math.min(100, Math.round((totalCal / targetCal) * 100));
  };

  const groupLogsByMeal = () => {
    const groups: Record<string, FoodLog[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };

    todayLogs.forEach(log => {
      const mealType = log.meal_type.toLowerCase();
      if (groups[mealType]) {
        groups[mealType].push(log);
      }
    });

    return groups;
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
        <ActionFAB
          onLogMeal={() => setFoodTrackerOpen(true)}
          onUploadActivity={() => setFitnessScreenshotOpen(true)}
        />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-background pb-20">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center flex-shrink-0">
              <Activity className="w-6 h-6 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">NutriSync</h1>
              <p className="text-sm text-muted-foreground">Fuel Your Run</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-1">Food & Nutrition</h2>
            <p className="text-sm text-muted-foreground">Track, calculate, and discover your optimal nutrition</p>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            <Button
              variant={activeTab === 'diary' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('diary')}
              className="flex-shrink-0"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Diary
            </Button>
            <Button
              variant={activeTab === 'suggestions' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('suggestions')}
              className="flex-shrink-0"
            >
              <Utensils className="w-4 h-4 mr-2" />
              Suggestions
            </Button>
            <Button
              variant={activeTab === 'training' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setActiveTab('training');
                navigate('/goals');
              }}
              className="flex-shrink-0"
            >
              <Activity className="w-4 h-4 mr-2" />
              Training
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Diary Tab */}
          {activeTab === 'diary' && (
            <>
              {/* Today's Nutrition Card */}
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-1">Today's Nutrition</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track your daily intake and stay on target
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Calories */}
                    <div>
                      <div className="text-2xl font-bold">{todayTotals.calories}</div>
                      <div className="text-sm text-muted-foreground">/ {targets.calories} kcal</div>
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-pink-500"
                          style={{ width: `${Math.min(100, (todayTotals.calories / targets.calories) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Protein */}
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{todayTotals.protein}g</div>
                      <div className="text-sm text-muted-foreground">/ {targets.protein}g protein</div>
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(100, (todayTotals.protein / targets.protein) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Carbs */}
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{todayTotals.carbs}g</div>
                      <div className="text-sm text-muted-foreground">/ {targets.carbs}g carbs</div>
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${Math.min(100, (todayTotals.carbs / targets.carbs) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Fat */}
                    <div>
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{todayTotals.fat}g</div>
                      <div className="text-sm text-muted-foreground">/ {targets.fat}g fat</div>
                      <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${Math.min(100, (todayTotals.fat / targets.fat) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-12"
                  onClick={() => navigate('/meals/history')}
                >
                  Food Log
                </Button>
                <Button
                  className="h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white"
                  onClick={() => setFoodTrackerOpen(true)}
                >
                  Add Food
                </Button>
              </div>

              {/* Meals by Type */}
              {Object.entries(groupLogsByMeal()).map(([mealType, logs]) => (
                <Card key={mealType} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                        {getMealTypeIcon(mealType as MealFilter)}
                        {mealType}
                      </h3>
                      <div className="flex items-center gap-2">
                        {logs.length > 0 && (
                          <span className="text-sm font-medium text-yellow-600">
                            ⭐ {getMealScore(mealType)}% Score
                          </span>
                        )}
                      </div>
                    </div>

                    {logs.length > 0 ? (
                      <div className="space-y-2">
                        {logs.map((log) => (
                          <div key={log.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{log.food_name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(log.logged_at), 'hh:mm a')} • 1 bowl
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  P: {log.protein_grams}g C: {log.carbs_grams}g F: {log.fat_grams}g
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">{log.calories} kcal</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No {mealType} logged yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <>
              <Card className="shadow-card">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-1">Smart Food Suggestions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Personalized nutrition recommendations based on your training schedule
                  </p>

                  {/* Meal Type Filters */}
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'breakfast', 'lunch', 'dinner', 'snack', 'pre-run', 'post-run', 'race-day'] as MealFilter[]).map((filter) => (
                      <Button
                        key={filter}
                        variant={mealFilter === filter ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMealFilter(filter)}
                        className="flex items-center gap-2"
                      >
                        {getMealTypeIcon(filter)}
                        <span className="capitalize">{filter.replace('-', ' ')}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI-Recommended Recipe Cards */}
              <div className="space-y-4">
                {recommendedRecipes.length === 0 && (
                  <Card className="shadow-card">
                    <CardContent className="p-8 text-center">
                      <Utensils className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Loading personalized recommendations...</p>
                    </CardContent>
                  </Card>
                )}
                {recommendedRecipes.map(({ recipe, score, reasons, compatibility }) => (
                  <Card key={recipe.id} className="shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{recipe.name}</h3>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {recipe.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-full capitalize">
                                {tag.replace('-', ' ')}
                              </span>
                            ))}
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${getCompatibilityColor(compatibility)}`}>
                              {compatibility} ({Math.round(score)}%)
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="text-xl font-bold">{recipe.nutrients_per_serving.calories} kcal</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {recipe.prep_time} min
                          </div>
                        </div>
                      </div>

                      {/* AI Reasons */}
                      {reasons.length > 0 && (
                        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">🤖 Why we recommend this:</div>
                          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            {reasons.map((reason, idx) => (
                              <li key={idx}>• {reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg py-2">
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{recipe.nutrients_per_serving.protein_g}g</div>
                          <div className="text-xs text-muted-foreground">Protein</div>
                        </div>
                        <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg py-2">
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">{recipe.nutrients_per_serving.cho_g}g</div>
                          <div className="text-xs text-muted-foreground">Carbs</div>
                        </div>
                        <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-lg py-2">
                          <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{recipe.nutrients_per_serving.fat_g}g</div>
                          <div className="text-xs text-muted-foreground">Fat</div>
                        </div>
                      </div>

                      {recipe.ingredients && recipe.ingredients.length > 0 && (
                        <div className="mb-3 text-xs text-muted-foreground">
                          <strong>Ingredients:</strong> {recipe.ingredients.join(', ')}
                        </div>
                      )}

                      <Button 
                        className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                        onClick={() => {
                          // In production, this would add the recipe to food diary
                          setFoodTrackerOpen(true);
                        }}
                      >
                        Add to Food Diary
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNav />
      <ActionFAB
        onLogMeal={() => setFoodTrackerOpen(true)}
        onUploadActivity={() => setFitnessScreenshotOpen(true)}
      />
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
    </>
  );
}
