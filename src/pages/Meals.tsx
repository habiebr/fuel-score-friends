import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { ActionFAB } from '@/components/ActionFAB';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { FoodLogEditDialog } from '@/components/FoodLogEditDialog';
import { FitnessScreenshotDialog } from '@/components/FitnessScreenshotDialog';
import { PageHeading } from '@/components/PageHeading';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Utensils,
  Activity,
  Coffee,
  Moon,
  Apple,
  Zap,
  Award,
  Clock,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, addDays, subDays } from 'date-fns';
import {
  Recipe,
  RecipeScore,
  UserPreferences,
  recommendRecipesForMeal,
  calculateBMR,
  calculateTDEE,
  calculateMacros,
  type TrainingLoad
} from '@/lib/nutrition-engine';
import { getActivityMultiplier, deriveMacrosFromCalories, accumulateConsumedFromFoodLogs } from '@/lib/nutrition';
import { getLocalDayBoundaries, getLocalDateString } from '@/lib/timezone';

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

type Tab = 'diary' | 'history' | 'suggestions';
type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre-run' | 'post-run' | 'race-day';

export default function Meals() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getTodayData, lastSync } = useGoogleFitSync();
  const [activeTab, setActiveTab] = useState<Tab>('diary');
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedFoodLog, setSelectedFoodLog] = useState<FoodLog | null>(null);
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
  // Weekly diary state (last 7 days)
  const [weekLogs, setWeekLogs] = useState<Record<string, FoodLog[]>>({});
  const [weekTotals, setWeekTotals] = useState<Record<string, { calories: number; protein: number; carbs: number; fat: number }>>({});
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [historyWeekStart, setHistoryWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [historyLoading, setHistoryLoading] = useState(true);
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
  const [aiPlan, setAiPlan] = useState<any | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planKey, setPlanKey] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    dietary_restrictions: [],
    eating_behaviors: [],
    time_budget_min: 60
  });
  const tabOptions = [
    { value: 'diary' as Tab, label: 'Today', icon: BookOpen },
    { value: 'history' as Tab, label: 'History', icon: Calendar },
    { value: 'suggestions' as Tab, label: 'Suggestions', icon: Utensils }
  ];
  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const isCurrentWeek = historyWeekStart >= currentWeekStart;
  const historyWeekRangeLabel = `${format(historyWeekStart, 'MMM dd')} - ${format(addDays(historyWeekStart, 6), 'MMM dd')}`;

  useEffect(() => {
    if (user) {
      loadDiaryData();
      loadUserPreferences();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadWeekData(historyWeekStart);
    }
  }, [user, historyWeekStart]);

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
      const today = getLocalDateString();
      const { start, end } = getLocalDayBoundaries(new Date());

      // Fetch today's food logs using local timezone boundaries
      const { data: todayLogs, error: todayError } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', start)
        .lte('logged_at', end)
        .order('logged_at', { ascending: false });

      if (todayError) {
        console.error('Error fetching today logs:', todayError);
        throw todayError;
      }

      setTodayLogs(todayLogs || []);

      // Calculate totals using the same function as Dashboard
      const totals = accumulateConsumedFromFoodLogs(todayLogs || []);
      setTodayTotals(totals);

      // Load user's nutrition targets from profile
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('weight_kg, height_cm, age, sex, activity_level')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        throw profileError;
      }

      if (profile) {
        // Determine training load - PREFER PLANNED TRAINING over actual activity
        const determineTrainingLoad = async (): Promise<TrainingLoad> => {
          // 1. Check for planned training from training_activities table
          const today = getLocalDateString(new Date());
          const { data: plannedActivities } = await (supabase as any)
            .from('training_activities')
            .select('*')
            .eq('user_id', user?.id)
            .eq('date', today);
          
          if (plannedActivities && plannedActivities.length > 0) {
            // Use planned training to determine load
            const totalDuration = plannedActivities.reduce((sum: number, act: any) => sum + (act.duration_minutes || 0), 0);
            const totalDistance = plannedActivities.reduce((sum: number, act: any) => sum + (act.distance_km || 0), 0);
            const hasRest = plannedActivities.some((act: any) => act.activity_type === 'rest');
            const hasHighIntensity = plannedActivities.some((act: any) => act.intensity === 'high');
            
            console.log('📅 Meals Page - Using PLANNED training from training_activities:', {
              activities: plannedActivities.length,
              totalDuration,
              totalDistance,
              hasRest,
              hasHighIntensity
            });
            
            // Classify based on planned workout
            if (hasRest && plannedActivities.length === 1) return 'rest';
            if (totalDistance >= 15) return 'long';
            if (hasHighIntensity || (totalDuration >= 60 && totalDistance >= 10)) return 'quality';
            if (totalDuration >= 45 || totalDistance >= 8) return 'moderate';
            return 'easy';
          }
          
          // 2. Fallback: Infer from actual activity (Google Fit)
          console.log('⚠️ Meals Page - No planned training found, inferring from actual Google Fit data');
          const todayFitData = await getTodayData();
          const activeMinutes = todayFitData?.activeMinutes || 0;
          const distanceKm = (todayFitData?.distanceMeters || 0) / 1000;
          
          if (activeMinutes < 15 && distanceKm < 2) return 'rest';
          if (activeMinutes < 45 || distanceKm < 8) return 'easy';
          if (distanceKm >= 15) return 'long';
          if (activeMinutes >= 60 && distanceKm >= 10) return 'quality';
          return 'moderate';
        };
        
        const trainingLoad = await determineTrainingLoad();
        
        // Get today's Google Fit data for exercise calories
        const todayFitData = await getTodayData();
        
        // Create profile object for nutrition-engine
        const userProfile = {
          weightKg: profile.weight_kg || 70,
          heightCm: profile.height_cm || 170,
          age: profile.age || 30,
          sex: (profile.sex || 'male') as 'male' | 'female'
        };
        
        // Use science layer: Calculate TDEE based on training load
        const tdee = calculateTDEE(userProfile, trainingLoad);
        
        // Use science layer: Calculate runner-specific macros (g/kg body weight)
        const scienceMacros = calculateMacros(userProfile, trainingLoad, tdee);
        
        // Add calories burned from training
        const caloriesBurnedToday = todayFitData?.caloriesBurned || 0;
        const calorieTarget = tdee + caloriesBurnedToday;
        
        // Scale macros if we added exercise calories
        let macroTargets;
        if (caloriesBurnedToday > 0) {
          const scale = calorieTarget / tdee;
          macroTargets = {
            protein: Math.round(scienceMacros.protein * scale),
            carbs: Math.round(scienceMacros.cho * scale),
            fat: Math.round(scienceMacros.fat * scale)
          };
        } else {
          macroTargets = {
            protein: scienceMacros.protein,
            carbs: scienceMacros.cho,
            fat: scienceMacros.fat
          };
        }
        
        console.log('📊 Meals Page - Runner-Specific Nutrition (Science Layer):', {
          profile: {
            age: profile.age,
            sex: profile.sex,
            weight_kg: profile.weight_kg,
            height_cm: profile.height_cm,
            activity_level: profile.activity_level
          },
          trainingLoad,
          tdee,
          caloriesBurnedToday,
          finalTarget: calorieTarget,
          macroTargets: {
            protein: `${macroTargets.protein}g (${(macroTargets.protein / userProfile.weightKg).toFixed(1)} g/kg)`,
            carbs: `${macroTargets.carbs}g (${(macroTargets.carbs / userProfile.weightKg).toFixed(1)} g/kg)`,
            fat: `${macroTargets.fat}g`
          },
          scienceBasedMacros: scienceMacros
        });
        
        setTargets({
          calories: calorieTarget,
          protein: macroTargets.protein,
          carbs: macroTargets.carbs,
          fat: macroTargets.fat
        });
      }
    } catch (error) {
      console.error('Error loading diary data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeekData = async (weekStartDate: Date) => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      // Generate array of dates for the week
      const days: string[] = [];
      const dayBoundaries: Array<{ date: string; start: string; end: string }> = [];
      
      for (let i = 0; i < 7; i++) {
        const date = addDays(weekStartDate, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        days.push(dateStr);
        
        // Get timezone-aware boundaries for each day
        const { start, end } = getLocalDayBoundaries(date);
        dayBoundaries.push({ date: dateStr, start, end });
      }

      console.log('📊 Loading week data with timezone boundaries:', dayBoundaries);

      // Fetch all logs for the week using timezone-aware boundaries
      const weekStart = dayBoundaries[0].start;
      const weekEnd = dayBoundaries[6].end;

      const { data: logs, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_at', weekStart)
        .lte('logged_at', weekEnd)
        .order('logged_at', { ascending: false });

      console.log('📊 Week logs fetched:', {
        count: logs?.length,
        weekStart,
        weekEnd,
        logs
      });

      if (error) {
        console.error('Error fetching week logs:', error);
        throw error;
      }

      const grouped: Record<string, FoodLog[]> = {};
      const totalsByDay: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};

      (logs || []).forEach((log) => {
        // Convert UTC timestamp to local date string to avoid timezone issues
        const day = format(new Date(log.logged_at), 'yyyy-MM-dd');
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(log);
      });

      Object.keys(grouped).forEach((day) => {
        totalsByDay[day] = accumulateConsumedFromFoodLogs(grouped[day]);
      });

      // Ensure all days exist in the map
      days.forEach((dateStr) => {
        if (!grouped[dateStr]) grouped[dateStr] = [];
        if (!totalsByDay[dateStr]) {
          totalsByDay[dateStr] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        }
      });

      setWeekDays(days);
      setWeekLogs(grouped);
      setWeekTotals(totalsByDay);
    } catch (error) {
      console.error('Error loading weekly data:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadUserPreferences = async () => {
    if (!user) return;
    try {
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('dietary_restrictions, eating_behaviors')
        .eq('user_id', user.id)
        .maybeSingle();

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

  const handleEditFoodLog = (log: FoodLog) => {
    setSelectedFoodLog(log);
    setEditDialogOpen(true);
  };

  const handleSaveFoodLog = () => {
    setEditDialogOpen(false);
    setSelectedFoodLog(null);
    loadDiaryData(); // Refresh the diary
    if (activeTab === 'history') {
      loadWeekData(historyWeekStart); // Refresh history if viewing it
    }
  };

  const handleDeleteFoodLog = () => {
    setEditDialogOpen(false);
    setSelectedFoodLog(null);
    loadDiaryData(); // Refresh the diary
    if (activeTab === 'history') {
      loadWeekData(historyWeekStart); // Refresh history if viewing it
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
    // Deprecated mock recipes removed. Use AI plan or a future recipes table.
    setRecipes([]);
  };

  const extractRecipesFromAiPlan = (plan: any): Recipe[] => {
    if (!plan) return [];
    const meals = ['breakfast','lunch','dinner','snack'];
    const list: Recipe[] = [];
    meals.forEach((m) => {
      const meal = plan[m];
      if (meal && Array.isArray(meal.suggestions)) {
        meal.suggestions.forEach((s: any, idx: number) => {
          list.push({
            id: `${m}-${idx}`,
            name: s.name || `Menu ${m}`,
            nutrients_per_serving: {
              calories: s.calories || meal.target_calories,
              cho_g: s.carbs ?? meal.target_carbs,
              protein_g: s.protein ?? meal.target_protein,
              fat_g: s.fat ?? meal.target_fat
            },
            prep_time: s.prep_time || 10,
            cost_est: 3,
            tags: [m, 'indonesian'],
            ingredients: s.foods || []
          });
        });
      }
    });
    return list;
  };

  const generateAIPlan = async () => {
    if (!user) return;
    try {
      setGeneratingPlan(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      // First, trigger training update (supabase client injects auth headers)
      try {
        await supabase.functions.invoke('update-actual-training', {
          body: { userId: user.id, date: today }
        });
        console.log('Training data updated');
      } catch (e) {
        console.warn('Failed to update training data:', e);
      }

      const cacheKey = `nutritionSuggestions:${today}:${planKey || 'default'}`;
      const { data: prefData } = await (supabase as any)
        .from('user_preferences')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', cacheKey)
        .maybeSingle();

      if (prefData?.value?.meals) {
        setAiPlan(prefData.value.meals);
        setLastUpdated(prefData.value.updatedAt || new Date().toISOString());
        setRecommendedRecipes(extractRecipesFromAiPlan(prefData.value.meals).map(r => ({ recipe: r, score: 90, reasons: [], compatibility: 'good' })));
        setGeneratingPlan(false);
        return;
      }
      
        const apiKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      const { data, error } = await supabase.functions.invoke('smart-ai-cache', {
        body: { date: today },
        headers: {
          ...(apiKey ? { apikey: apiKey } : {})
        }
      });
      if (error) throw error;
      setAiPlan(data?.meals || null);
      setLastUpdated(new Date().toISOString());
      const toCache = { meals: data?.meals || null, updatedAt: new Date().toISOString() };
      await (supabase as any)
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          key: cacheKey,
          value: toCache,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key'
        });
      setRecommendedRecipes(extractRecipesFromAiPlan(data?.meals || null).map(r => ({ recipe: r, score: 90, reasons: [], compatibility: 'good' })));
      toast({ title: 'Nutrition suggestions ready', description: 'Personalized suggestions generated for today.' });
    } catch (e: any) {
      toast({ title: 'AI generation failed', description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setGeneratingPlan(false);
    }
  };

  const updatePlanKeyFromActivity = async () => {
    if (!user) return;
    try {
      const today = await getTodayData();
      const steps = today?.steps || 0;
      const distance = (today as any)?.distance_meters ?? today?.distanceMeters ?? 0;
      const sessionsCount = Array.isArray(today?.sessions) ? today.sessions.length : 0;
      const ls = lastSync ? new Date(lastSync).toISOString() : 'nosync';
      const key = `${steps}|${Math.round(distance)}|${sessionsCount}|${ls}`.slice(0, 128);
      setPlanKey(key);
    } catch {
      setPlanKey('none');
    }
  };

  // Recompute plan key whenever Google Fit lastSync changes
  useEffect(() => {
    if (user) {
      updatePlanKeyFromActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSync, user]);

  // Auto-generate when planKey changes (e.g., training plan updated)
  // But only if we don't have a recent plan cached
  useEffect(() => {
    const checkAndGenerate = async () => {
      if (!user) return;
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const cacheKey = `nutritionSuggestions:${today}:${planKey || 'default'}`;
      
      // Check if we already have cached data for this plan key
      const { data: prefData } = await (supabase as any)
        .from('user_preferences')
        .select('value')
        .eq('user_id', user.id)
        .eq('key', cacheKey)
        .maybeSingle();

      // Only generate if no cache exists or cache is older than 4 hours
      if (prefData?.value?.meals && prefData?.value?.updatedAt) {
        const cacheAge = Date.now() - new Date(prefData.value.updatedAt).getTime();
        const fourHoursInMs = 4 * 60 * 60 * 1000;
        
        if (cacheAge < fourHoursInMs) {
          console.log('Using cached nutrition suggestions (cache age:', Math.round(cacheAge / 60000), 'minutes)');
          setAiPlan(prefData.value.meals);
          setLastUpdated(prefData.value.updatedAt);
          setRecommendedRecipes(extractRecipesFromAiPlan(prefData.value.meals).map(r => ({ recipe: r, score: 90, reasons: [], compatibility: 'good' })));
          return; // Don't generate, use cache
        }
      }
      
      // No cache or cache is stale - generate new plan
      console.log('Generating new nutrition suggestions...');
      generateAIPlan();
    };
    
    if (user && planKey) {
      checkAndGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

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
        <div className="max-w-none mx-auto p-4">
          <PageHeading
            title="Meals"
            description="Track, review and plan your nutrition"
            icon={Utensils}
          />

          <div className="mb-6">
            <div className="flex flex-wrap justify-center gap-1 rounded-full border border-white/10 bg-black/10 p-1 shadow-inner backdrop-blur-sm dark:border-white/20 dark:bg-white/10">
                {tabOptions.map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab(value)}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 text-sm font-medium transition-all whitespace-nowrap",
                      activeTab === value
                        ? "bg-primary text-primary-foreground shadow-[0_12px_30px_rgba(49,255,176,0.35)]"
                        : "text-muted-foreground hover:bg-white/20 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

          {/* Content */}
          <div className="space-y-4">
            {/* History Tab */}
            {activeTab === 'history' && (
              <Card className="shadow-card w-full max-w-full">
                <CardContent className="p-4 sm:p-6 space-y-4 w-full max-w-full box-border">
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold">Weekly Food Diary</h3>
                      <p className="text-sm text-muted-foreground">Review your logged meals for the selected week.</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryWeekStart(subDays(historyWeekStart, 7))}
                        className="rounded-full flex-shrink-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-muted-foreground dark:border-white/20 dark:bg-white/10 text-center min-w-0 flex-1">
                        {historyWeekRangeLabel}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryWeekStart(addDays(historyWeekStart, 7))}
                        className="rounded-full flex-shrink-0"
                        disabled={isCurrentWeek}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {historyLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : (
                  <>
                    <div className="space-y-3">
                        {weekDays.map((day) => {
                          const isToday = day === format(new Date(), 'yyyy-MM-dd');
                          const hasMeals = (weekTotals[day]?.calories || 0) > 0;
                          return (
                            <Card 
                              key={`d-${day}`} 
                              className={`border transition-all w-full max-w-full ${
                                isToday 
                                  ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50/30 dark:bg-blue-900/10' 
                                  : hasMeals 
                                  ? 'hover:shadow-lg' 
                                  : 'opacity-60'
                              }`}
                            >
                            <CardContent className="p-3 w-full max-w-full box-border">
                              <div className="flex flex-wrap items-center justify-between mb-3">
                                <div className={`font-bold text-base ${isToday ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                                  {format(new Date(day), 'EEE, MMM d')}
                                  {isToday && <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Today</span>}
                                </div>
                                <div className="text-base font-bold">{Math.round(weekTotals[day]?.calories || 0)} kcal</div>
                              </div>
                              {(weekLogs[day] || []).length > 0 ? (
                                <div className="space-y-2">
                                  {(weekLogs[day] || []).map((log) => (
                                    <div 
                                      key={log.id} 
                                      className="flex items-start justify-between bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-2 w-full gap-1 cursor-pointer hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 transition-all active:scale-98"
                                      onClick={() => handleEditFoodLog(log)}
                                    >
                                      <div className="flex-1 min-w-0 pr-1">
                                        <div className="font-semibold truncate text-sm leading-tight">{log.food_name}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                          {format(new Date(log.logged_at), 'hh:mm a')} • <span className="capitalize">{log.meal_type}</span>
                                        </div>
                                      </div>
                                      <div className="flex-shrink-0 text-right">
                                        <div className="text-sm font-bold whitespace-nowrap">{log.calories}</div>
                                        <div className="text-[9px] text-muted-foreground whitespace-nowrap">
                                          <span className="text-blue-600 dark:text-blue-400">{log.protein_grams}</span>
                                          <span className="text-muted-foreground mx-0.5">/</span>
                                          <span className="text-green-600 dark:text-green-400">{log.carbs_grams}</span>
                                          <span className="text-muted-foreground mx-0.5">/</span>
                                          <span className="text-yellow-600 dark:text-yellow-400">{log.fat_grams}</span>
                                          <span className="text-muted-foreground">g</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                  No entries for this day
                                </div>
                              )}
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

          {/* Diary Tab */}
          {activeTab === 'diary' && (
            <>
              {/* Today's Nutrition Card */}
              <Card className="shadow-card">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-lg font-semibold mb-1">Today's Nutrition</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Track your daily intake and stay on target
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Calories */}
                    <div>
                      <div className="text-2xl font-bold">{Math.round(todayTotals.calories)}</div>
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
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round(todayTotals.protein)}g</div>
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
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{Math.round(todayTotals.carbs)}g</div>
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
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{Math.round(todayTotals.fat)}g</div>
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

              {/* Add Food */}
              <div className="grid grid-cols-1 gap-3">
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
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                        {getMealTypeIcon(mealType as MealFilter)}
                        {mealType}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
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
                          <div 
                            key={log.id} 
                            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-98"
                            onClick={() => handleEditFoodLog(log)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{log.food_name}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(log.logged_at), 'hh:mm a')} • {log.serving_size || '1 serving'}
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
                <CardContent className="p-4 sm:p-6">
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
                  {lastUpdated && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Last updated {new Date(lastUpdated).toLocaleTimeString()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI-Recommended Recipe Cards or AI Plan */}
              <div className="space-y-4">
                {aiPlan && (
                  <Card className="shadow-card">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-base mb-3">Meal Plan (Today)</h3>
                      {['breakfast','lunch','dinner','snack'].map((m) => aiPlan[m] ? (
                        <div key={m} className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                          <div className="flex flex-wrap items-center justify-between mb-2">
                            <div className="capitalize font-medium">{m}</div>
                            <div className="text-sm font-semibold">{aiPlan[m].target_calories} kcal</div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg py-2">
                              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{aiPlan[m].target_protein || 0}g</div>
                              <div className="text-xs text-muted-foreground">Protein</div>
                            </div>
                            <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg py-2">
                              <div className="text-lg font-bold text-green-600 dark:text-green-400">{aiPlan[m].target_carbs || 0}g</div>
                              <div className="text-xs text-muted-foreground">Carbs</div>
                            </div>
                            <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-lg py-2">
                              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{aiPlan[m].target_fat || 0}g</div>
                              <div className="text-xs text-muted-foreground">Fat</div>
                            </div>
                          </div>
                          {Array.isArray(aiPlan[m].suggestions) && aiPlan[m].suggestions.length > 0 && (
                            <ul className="space-y-1">
                              {aiPlan[m].suggestions.slice(0,2).map((s: any, i: number) => (
                                <li key={i} className="flex flex-wrap items-center justify-between text-sm">
                                  <span className="font-medium">{s.name}</span>
                                  <span className="text-muted-foreground">{s.calories} kcal</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null)}
                    </CardContent>
                  </Card>
                )}
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
      </div>

      <BottomNav />
      <ActionFAB
        onLogMeal={() => setFoodTrackerOpen(true)}
        onUploadActivity={() => setFitnessScreenshotOpen(true)}
      />
      <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />
      <FoodLogEditDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen}
        foodLog={selectedFoodLog}
        onSave={handleSaveFoodLog}
        onDelete={handleDeleteFoodLog}
      />
      <FitnessScreenshotDialog open={fitnessScreenshotOpen} onOpenChange={setFitnessScreenshotOpen} />
    </>
  );
}
