import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreCard } from '@/components/ScoreCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Target, Users, Zap, TrendingUp, ChevronLeft, ChevronRight, Camera, Utensils, Settings } from 'lucide-react';
import { Home } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { FoodTrackerDialog } from '@/components/FoodTrackerDialog';
import { RaceGoalWidget } from '@/components/RaceGoalWidget';
import { CombinedNutritionWidget } from '@/components/CombinedNutritionWidget';
import { RunnerNutritionDashboard } from '@/components/RunnerNutritionDashboard';
import { WeeklyScoreCard } from '@/components/WeeklyScoreCard';
import { getTodayUnifiedScore, getWeeklyActivityStats } from '@/services/unified-score.service';
import { TodayMealScoreCard } from '@/components/TodayMealScoreCard';
import { TodayNutritionCard } from '@/components/TodayNutritionCard';
import { WeeklyKilometersCard } from '@/components/WeeklyMilesCard';
import { UpcomingWorkouts } from '@/components/UpcomingWorkouts';
import { TodayInsightsCard } from '@/components/TodayInsightsCard';
import { PreTrainingFuelingWidget } from '@/components/PreTrainingFuelingWidget';
import { format, startOfWeek, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { RecoverySuggestion } from '@/components/RecoverySuggestion';
import { accumulatePlannedFromMealPlans, accumulateConsumedFromFoodLogs, computeDailyScore, getActivityMultiplier, deriveMacrosFromCalories } from '@/lib/nutrition';
import { calculateBMR, calculateTDEE, calculateMacros, type TrainingLoad } from '@/lib/nutrition-engine';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';
import { getLocalDayBoundaries, getLocalDateString } from '@/lib/timezone';

import { readDashboardCache, writeDashboardCache, clearDashboardCache } from '@/lib/dashboard-cache';

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
  heartRateAvg?: number | null;
  plannedCalories: number;
  plannedProtein: number;
  plannedCarbs: number;
  plannedFat: number;
  breakfastScore: number | null;
  lunchScore: number | null;
  dinnerScore: number | null;
  calories?: {
    consumed: number;
    target: number;
  };
  macros?: {
    protein?: { consumed: number; target: number };
    carbs?: { consumed: number; target: number };
    fat?: { consumed: number; target: number };
  };
  nextRun?: string;
}

interface DashboardProps {
  onAddMeal?: () => void;
  onAnalyzeFitness?: () => void;
}

export function Dashboard({ onAddMeal, onAnalyzeFitness }: DashboardProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const realtimeErrorLogged = useRef(false);
  const { syncGoogleFit, isSyncing, lastSync, syncStatus } = useGoogleFitSync();
  const [data, setData] = useState<DashboardData | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyScore, setWeeklyScore] = useState(0);
  const [todayScore, setTodayScore] = useState(0);
  const [todayBreakdown, setTodayBreakdown] = useState<{ nutrition: number; training: number; bonuses?: number; penalties?: number }>({ nutrition: 0, training: 0 });
  const [hasMainMeals, setHasMainMeals] = useState(false);
  // Removed manual generate plan action from dashboard
  const [currentMealIndex, setCurrentMealIndex] = useState(0);
  const [newActivity, setNewActivity] = useState<null | { planned?: string; actual?: string; sessionId: string }>(null);
  const [weeklyGoogleFitData, setWeeklyGoogleFitData] = useState<{ current: number; target: number }>({ current: 0, target: 30 });
  const [foodTrackerOpen, setFoodTrackerOpen] = useState(false);

  // Function to determine current meal based on time and Google Fit activity patterns
  const getCurrentMealType = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if we have Google Fit data to determine activity patterns
    if (data) {
      const steps = data.steps || 0;
      const calories_burned = data.caloriesBurned || 0;
      const heart_rate_avg = data.heartRateAvg || 0;
      
      // If user has been very active (high steps, high calories), they might need more frequent meals
      if (steps > 8000 || calories_burned > 500) {
        // More frequent meal pattern for active users
        if (currentHour >= 5 && currentHour < 10) return 'breakfast';
        if (currentHour >= 10 && currentHour < 14) return 'lunch';
        if (currentHour >= 14 && currentHour < 18) return 'snack';
        if (currentHour >= 18 && currentHour < 22) return 'dinner';
        return 'breakfast'; // Default to breakfast for very early/late hours
      }
      
      // If user has elevated heart rate, they might need energy
      if (heart_rate_avg && heart_rate_avg > 80) {
        if (currentHour >= 5 && currentHour < 11) return 'breakfast';
        if (currentHour >= 11 && currentHour < 16) return 'lunch';
        if (currentHour >= 16 && currentHour < 21) return 'dinner';
        return 'breakfast';
      }
    }
    
    // Default time-based pattern
    if (currentHour >= 5 && currentHour < 11) return 'breakfast';
    if (currentHour >= 11 && currentHour < 16) return 'lunch';
    if (currentHour >= 16 && currentHour < 21) return 'dinner';
    return 'breakfast'; // Default to breakfast for very early/late hours
  };

  // Carousel navigation functions
  const nextMeal = () => {
    setCurrentMealIndex((prev) => (prev + 1) % getAvailableMeals().length);
  };

  const prevMeal = () => {
    setCurrentMealIndex((prev) => (prev - 1 + getAvailableMeals().length) % getAvailableMeals().length);
  };

  const getAvailableMeals = () => {
    const currentMealType = getCurrentMealType();
    const plan = mealPlans.find(p => p.meal_type === currentMealType);
    
    if (plan && plan.meal_suggestions && Array.isArray(plan.meal_suggestions) && plan.meal_suggestions.length > 0) {
      return plan.meal_suggestions;
    }
    
    // Fallback to static suggestions
    const targetCalories = plan?.recommended_calories || 400;
    const indonesianSuggestion = getIndonesianMealSuggestions(currentMealType, targetCalories);
    return [indonesianSuggestion];
  };

  // Indonesian food suggestions with portions
  const getIndonesianMealSuggestions = (mealType: string, targetCalories: number) => {
    const suggestions = {
      breakfast: [
        {
          name: "Nasi Uduk + Ayam Goreng",
          description: "Nasi uduk dengan ayam goreng dan sambal kacang",
          foods: [
            "Nasi uduk (150g)",
            "Ayam goreng (100g)", 
            "Sambal kacang (30g)",
            "Timun (50g)",
            "Daun seledri (5g)"
          ],
          calories: 450,
          protein: 25,
          carbs: 45,
          fat: 18
        },
        {
          name: "Bubur Ayam",
          description: "Bubur nasi dengan ayam suwir dan pelengkap",
          foods: [
            "Bubur nasi (200g)",
            "Ayam suwir (80g)", 
            "Kacang kedelai (20g)",
            "Daun seledri (10g)",
            "Bawang goreng (5g)"
          ],
          calories: 380,
          protein: 22,
          carbs: 42,
          fat: 12
        },
        {
          name: "Lontong Sayur",
          description: "Lontong dengan sayur labu siam dan kuah santan",
          foods: [
            "Lontong (120g)",
            "Sayur labu siam (150g)", 
            "Santan (100ml)",
            "Tempe (50g)",
            "Bawang merah (10g)"
          ],
          calories: 320,
          protein: 18,
          carbs: 38,
          fat: 14
        }
      ],
      lunch: [
        {
          name: "Nasi Padang",
          description: "Nasi putih dengan rendang dan sayuran",
          foods: [
            "Nasi putih (150g)",
            "Rendang daging (100g)", 
            "Sayur daun singkong (100g)",
            "Sambal ijo (20g)",
            "Kerupuk (10g)"
          ],
          calories: 650,
          protein: 35,
          carbs: 55,
          fat: 28
        },
        {
          name: "Gado-gado",
          description: "Salad sayuran dengan bumbu kacang",
          foods: [
            "Sayuran segar (200g)",
            "Tahu (80g)", 
            "Tempe (60g)",
            "Bumbu kacang (45g)",
            "Kerupuk (15g)"
          ],
          calories: 420,
          protein: 28,
          carbs: 35,
          fat: 22
        },
        {
          name: "Soto Ayam",
          description: "Sup ayam dengan bumbu kuning dan pelengkap",
          foods: [
            "Daging ayam (120g)",
            "Nasi putih (150g)", 
            "Tauge (60g)",
            "Bawang goreng (10g)",
            "Sambal (15g)"
          ],
          calories: 480,
          protein: 32,
          carbs: 48,
          fat: 16
        }
      ],
      dinner: [
        {
          name: "Pecel Lele",
          description: "Lele goreng dengan sambal dan lalapan",
          foods: [
            "Lele goreng (200g)",
            "Nasi putih (150g)", 
            "Lalapan (100g)",
            "Sambal terasi (30g)",
            "Daun kemangi (10g)"
          ],
          calories: 520,
          protein: 38,
          carbs: 45,
          fat: 20
        },
        {
          name: "Rawon",
          description: "Sup daging dengan bumbu hitam khas Jawa Timur",
          foods: [
            "Daging sapi (120g)",
            "Nasi putih (150g)", 
            "Tauge (60g)",
            "Bawang goreng (10g)",
            "Sambal (15g)"
          ],
          calories: 480,
          protein: 35,
          carbs: 42,
          fat: 18
        },
        {
          name: "Ayam Bakar",
          description: "Ayam bakar dengan bumbu kecap dan nasi",
          foods: [
            "Ayam bakar (150g)",
            "Nasi putih (150g)", 
            "Tempe goreng (60g)",
            "Sambal (15g)",
            "Timun (50g)"
          ],
          calories: 450,
          protein: 30,
          carbs: 40,
          fat: 16
        }
      ]
    };

    const mealSuggestions = suggestions[mealType as keyof typeof suggestions] || [];
    
    // Find the suggestion closest to target calories
    const closestSuggestion = mealSuggestions.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.calories - targetCalories);
      const currentDiff = Math.abs(current.calories - targetCalories);
      return currentDiff < closestDiff ? current : closest;
    }, mealSuggestions[0]);

    return closestSuggestion || mealSuggestions[0];
  };

  useEffect(() => {
    if (user) {
      // Fast initial paint from cache
      const cached = readDashboardCache(user.id);
      if (cached?.data) {
        const { daily, weekly } = cached.data;
        setData(daily?.data || null);
        setTodayScore(daily?.todayScore || 0);
        setWeeklyScore(weekly?.weeklyScore || 0);
        setWeeklyGoogleFitData(weekly?.weeklyKm || { current: 0, target: 30 });
        setLoading(false);
      }
      loadDashboardData();
    }
  }, [user]);


  // Helper function to wait for session confirmation
  const waitForSessionConfirmation = async (): Promise<boolean> => {
    if (!user || !session) {
      console.log('Dashboard: No user or session available');
      return false;
    }

    try {
      // Test the session by making a simple authenticated request
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Dashboard: Session validation failed:', error);
        return false;
      }

      if (!data.session || !data.session.access_token) {
        console.log('Dashboard: No valid session token found');
        return false;
      }

      // Test the session by making a simple database query
      const { error: testError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (testError) {
        console.error('Dashboard: Session test query failed:', testError);
        return false;
      }

      console.log('Dashboard: Session confirmed and validated');
      return true;
    } catch (error) {
      console.error('Dashboard: Session confirmation error:', error);
      return false;
    }
  };

  // Realtime: debounced refresh when data changes
  useEffect(() => {
    if (!user || !session) {
      console.log('Dashboard: Skipping realtime subscription - no authenticated user');
      return;
    }

    let isSubscribed = false;
    let channel: any = null;

    const setupRealtimeSubscription = async () => {
      // Wait for session confirmation before connecting
      const sessionConfirmed = await waitForSessionConfirmation();
      
      if (!sessionConfirmed) {
        console.log('Dashboard: Session not confirmed, skipping realtime subscription');
        return;
      }

      if (isSubscribed) {
        console.log('Dashboard: Already subscribed, skipping');
        return;
      }

      let debounceTimer: ReturnType<typeof setTimeout>;
      const debouncedRefresh = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadDashboardData();
        }, 2000); // 2 second debounce
      };

      console.log('Dashboard: Setting up realtime subscription for user:', user.id);
      
      channel = supabase
        .channel('dashboard-realtime')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'daily_meal_plans', 
          filter: `user_id=eq.${user.id}` 
        }, debouncedRefresh)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'food_logs', 
          filter: `user_id=eq.${user.id}` 
        }, debouncedRefresh)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'training_activities',
          filter: `user_id=eq.${user.id}`
        }, () => {
          console.log('🏃 Training schedule changed - refreshing nutrition calculations');
          debouncedRefresh();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'google_fit_data',
          filter: `user_id=eq.${user.id}`
        }, async (payload) => {
          try {
            // Only aggregate when a session-linked row changes
            const sessions = (payload?.new as any)?.sessions;
            const hasLinkedSessions = Array.isArray(sessions) && sessions.length > 0;
            if (!hasLinkedSessions) return;
            const dateISO = (payload?.new as any)?.date;
            await supabase.functions.invoke('aggregate-weekly-activity', {
              body: { userId: user.id, dateISO }
            });
          } catch (e) {
            console.warn('Aggregator invoke failed:', e);
          } finally {
            debouncedRefresh();
          }
        })
        .subscribe((status) => {
          console.log('Dashboard realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            console.log('Dashboard: Successfully subscribed to realtime updates');
            isSubscribed = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (!realtimeErrorLogged.current) {
              console.warn('Dashboard: Realtime subscription failed with status:', status);
              realtimeErrorLogged.current = true;
            }
            isSubscribed = false;
            if (channel) {
              supabase.removeChannel(channel);
              channel = null;
            }
            // Don't treat this as a critical error - app can work without realtime
          }
        });
    };

    // Add a small delay to ensure session is fully established
    const timer = setTimeout(setupRealtimeSubscription, 1000);

    return () => {
      clearTimeout(timer);
      if (channel) {
        try { 
          console.log('Dashboard: Cleaning up realtime subscription');
          supabase.removeChannel(channel); 
          isSubscribed = false;
        } catch (error) {
          console.warn('Dashboard: Error removing realtime channel:', error);
        }
      }
    };
  }, [user, session]);

  // race goal widget removed

  // Manual plan generation removed

  const loadDashboardData = async () => {
    if (!user || !session) {
      console.warn('Dashboard: No authenticated user or session available');
      return;
    }

    setLoading((prev) => prev || !data);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { start, end } = getLocalDayBoundaries(new Date());

      // Batch weekly data fetching - use direct queries instead of RPC
      const weeklyDataPromise = Promise.all([
        supabase
          .from('nutrition_scores')
          .select('date, daily_score, calories_consumed, protein_grams, carbs_grams, fat_grams, meals_logged')
          .eq('user_id', user.id)
          .gte('date', format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
          .lte('date', today)
          .order('date', { ascending: false }),
        supabase
          .from('google_fit_data')
          .select('date, distance_meters, steps, calories_burned, active_minutes')
          .eq('user_id', user.id)
          .gte('date', format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
          .lte('date', today)
          .order('date', { ascending: false })
      ]);

      // Batch all Supabase queries with direct table access
      const [foodLogsData, mealPlansData, profileData, googleFitDataResult] = await Promise.all([
        supabase
          .from('food_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('logged_at', start)
          .lte('logged_at', end)
          .order('logged_at', { ascending: false }),
        supabase
          .from('daily_meal_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today),
        supabase
          .from('profiles')
          .select('age, sex, weight_kg, height_cm, activity_level')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('google_fit_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle()
      ]);

      // Check for authentication errors
      if (foodLogsData.error && foodLogsData.error.message.includes('access control')) {
        console.error('Authentication error in food_logs:', foodLogsData.error);
        throw new Error('Authentication required. Please sign in again.');
      }
      if (mealPlansData.error && mealPlansData.error.message.includes('access control')) {
        console.error('Authentication error in daily_meal_plans:', mealPlansData.error);
        throw new Error('Authentication required. Please sign in again.');
      }
      if (profileData.error && profileData.error.message.includes('access control')) {
        console.error('Authentication error in profiles:', profileData.error);
        throw new Error('Authentication required. Please sign in again.');
      }

      const foodLogs = foodLogsData.data || [];
      const rawMealPlans = mealPlansData.data || [];
      const profile = profileData.data;
      const todayGoogleFitData = googleFitDataResult.data;
      
      // Check if user has logged any main meals (not just snacks)
      const mainMeals = foodLogs.filter(log => 
        ['breakfast', 'lunch', 'dinner'].includes(log.meal_type?.toLowerCase() || '')
      );
      const hasMainMeals = mainMeals.length > 0;
      
      const normalizedMealPlans: MealPlan[] = rawMealPlans.map((plan) => ({
        ...plan,
        meal_suggestions: Array.isArray(plan.meal_suggestions)
          ? (plan.meal_suggestions as unknown as MealSuggestion[])
          : []
      }));

      setMealPlans(normalizedMealPlans);

      const exerciseData = {
        steps: todayGoogleFitData?.steps || 0,
        calories_burned: todayGoogleFitData?.caloriesBurned || 0,
        active_minutes: todayGoogleFitData?.activeMinutes || 0,
        heart_rate_avg: todayGoogleFitData?.heartRateAvg || null,
        distance_meters: todayGoogleFitData?.distanceMeters || 0,
        sessions: todayGoogleFitData?.sessions || []
      };

      // Determine training load - PREFER PLANNED TRAINING over actual activity
      const determineTrainingLoad = async (): Promise<TrainingLoad> => {
        // 1. Check for planned training from training_activities table
        const today = getLocalDateString(new Date());
        const { data: plannedActivities } = await (supabase as any)
          .from('training_activities')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today);
        
        if (plannedActivities && plannedActivities.length > 0) {
          // Use planned training to determine load
          const totalDuration = plannedActivities.reduce((sum: number, act: any) => sum + (act.duration_minutes || 0), 0);
          const totalDistance = plannedActivities.reduce((sum: number, act: any) => sum + (act.distance_km || 0), 0);
          const hasRest = plannedActivities.some((act: any) => act.activity_type === 'rest');
          const hasHighIntensity = plannedActivities.some((act: any) => act.intensity === 'high');
          
          // Check for user's explicit activity label (Priority 1)
          const userLabel = plannedActivities[0]?.user_activity_label;
          
          console.log('📅 Using PLANNED training from training_activities:', {
            activities: plannedActivities.length,
            totalDuration,
            totalDistance,
            hasRest,
            hasHighIntensity,
            userLabel
          });
          
          // Priority 1: User's explicit activity designation
          if (userLabel === 'long_run') return 'long';
          if (userLabel === 'interval') return 'quality';
          
          // Priority 2: Automatic classification based on parameters
          if (hasRest && plannedActivities.length === 1) return 'rest';
          if (totalDistance >= 15) return 'long';
          if (hasHighIntensity) return 'quality'; // Quality = intensity-based only (tempo, intervals, hills)
          if (totalDuration >= 60 || totalDistance >= 10) return 'moderate';
          if (totalDuration >= 30 || totalDistance >= 5) return 'easy';
          return 'rest';
        }
        
        // 2. Fallback: Infer from actual activity (Google Fit)
        console.log('⚠️ No planned training found, inferring from actual Google Fit data');
        const activeMinutes = exerciseData.active_minutes || 0;
        const distanceKm = (exerciseData.distance_meters || 0) / 1000;
        
        // Rest day: minimal activity
        if (activeMinutes < 15 && distanceKm < 2) return 'rest';
        
        // Long run: high distance (priority)
        if (distanceKm >= 15) return 'long';
        
        // Moderate: sustained effort
        if (activeMinutes >= 60 || distanceKm >= 10) return 'moderate';
        
        // Easy: light activity
        if (activeMinutes >= 30 || distanceKm >= 5) return 'easy';
        
        // Default to rest
        return 'rest';
      };

      const trainingLoad = await determineTrainingLoad();

      // Calculate nutrition targets using SCIENCE LAYER (runner-specific)
      let targetCalories = 0;
      let macroTargets = { protein: 0, carbs: 0, fat: 0 };

      if (profile && profile.weight_kg && profile.height_cm && profile.age && profile.sex) {
        // Create profile object for nutrition-engine
        const userProfile = {
          weightKg: profile.weight_kg,
          heightCm: profile.height_cm,
          age: profile.age,
          sex: profile.sex as 'male' | 'female'
        };
        
        // Use science layer: Calculate TDEE based on training load
        const tdee = calculateTDEE(userProfile, trainingLoad);
        
        // Use science layer: Calculate macros based on body weight and training load
        // This gives runner-specific CHO (g/kg) and protein (g/kg) targets!
        const scienceMacros = calculateMacros(userProfile, trainingLoad, tdee);
        
        // Add calories burned from training (on top of TDEE)
        const caloriesBurnedToday = exerciseData.calories_burned || 0;
        targetCalories = tdee + caloriesBurnedToday;
        
        // Scale macros if we added exercise calories
        if (caloriesBurnedToday > 0) {
          const scale = targetCalories / tdee;
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
        
        console.log('📊 Dashboard - Runner-Specific Nutrition (Science Layer):', { 
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
          finalTarget: targetCalories, 
          macroTargets: {
            protein: `${macroTargets.protein}g (${(macroTargets.protein / profile.weight_kg).toFixed(1)} g/kg)`,
            carbs: `${macroTargets.carbs}g (${(macroTargets.carbs / profile.weight_kg).toFixed(1)} g/kg)`,
            fat: `${macroTargets.fat}g`
          },
          scienceBasedMacros: scienceMacros
        });
      }

      const plannedNutrition = accumulatePlannedFromMealPlans(rawMealPlans);
      const consumedNutrition = accumulateConsumedFromFoodLogs(foodLogs);
      
      console.log('📊 Dashboard food logs:', {
        count: foodLogs.length,
        start,
        end,
        logs: foodLogs
      });
      console.log('📊 Dashboard consumed nutrition:', consumedNutrition);
      console.log('📊 Dashboard targets:', { targetCalories, macroTargets });
      
      // Get today's unified score with error handling
      let unifiedScoreResult = null;
      try {
        unifiedScoreResult = await getTodayUnifiedScore(user.id, 'runner-focused');
        console.log('Today unified score:', unifiedScoreResult);
      } catch (scoreError) {
        console.error('Error getting today unified score:', scoreError);
        unifiedScoreResult = null;
      }
      
      setTodayScore(unifiedScoreResult?.score || 0);
      setTodayBreakdown({
        nutrition: unifiedScoreResult?.breakdown?.nutrition?.total || 0,
        training: unifiedScoreResult?.breakdown?.training?.total || 0,
        bonuses: unifiedScoreResult?.breakdown?.bonuses || 0,
        penalties: unifiedScoreResult?.breakdown?.penalties || 0
      });
      setHasMainMeals(hasMainMeals);

      // Get weekly unified score with error handling
      let weeklyScoreResult = null;
      try {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Start of week (Monday)
        weeklyScoreResult = await getWeeklyActivityStats(weekStart);
        console.log('📊 WEEKLY SCORE DEBUG:', {
          weekStart: format(weekStart, 'yyyy-MM-dd'),
          result: weeklyScoreResult,
          average: weeklyScoreResult?.average,
          dailyScores: weeklyScoreResult?.dailyScores,
          validScoresCount: weeklyScoreResult?.dailyScores?.filter(d => d.score > 0).length
        });
      } catch (weeklyScoreError) {
        console.error('❌ Error getting weekly unified score:', weeklyScoreError);
        weeklyScoreResult = null;
      }
      
      const calculatedWeeklyScore = weeklyScoreResult?.average || 0;
      console.log('📊 Setting weekly score to:', calculatedWeeklyScore);
      setWeeklyScore(calculatedWeeklyScore);

      // Use the already calculated values from above

      // Process activity data
      try {
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const weekPlan = profile?.activity_level ? JSON.parse(profile.activity_level) : null;
        const dayPlan = Array.isArray(weekPlan) ? weekPlan.find((d: any) => d && d.day === todayName) : null;
        const plannedText = dayPlan ? `${dayPlan.activity || 'rest'}${dayPlan.distanceKm ? ` ${dayPlan.distanceKm} km` : dayPlan.duration ? ` ${dayPlan.duration} min` : ''}` : 'rest';

        const sessions: any[] = Array.isArray(exerciseData.sessions) ? [...exerciseData.sessions] : [];
        sessions.sort((a, b) => (parseInt(b.endTimeMillis || '0') - parseInt(a.endTimeMillis || '0')));
        const latest = sessions[0];
        if (latest) {
          const id = `${latest.startTimeMillis}-${latest.endTimeMillis}`;
          const lastAck = localStorage.getItem('lastAckSessionId');
          const ended = parseInt(latest.endTimeMillis || '0');
          const isRecent = Date.now() - ended < 6 * 60 * 60 * 1000;
          const activityType = (latest.activityType || latest.application || latest.name || 'activity').toString();
          const actualText = `${activityType}${latest?.distance ? ` ${(latest.distance / 1000).toFixed(1)} km` : ''}`;
          if (isRecent && id !== lastAck) {
            setNewActivity({ planned: plannedText, actual: actualText, sessionId: id });
          }
        }
      } catch (_) {}

      // Update dashboard data
      const dashboardData = {
        dailyScore: unifiedScoreResult?.score || 0,
        caloriesConsumed: consumedNutrition.calories,
        proteinGrams: consumedNutrition.protein,
        carbsGrams: consumedNutrition.carbs,
        fatGrams: consumedNutrition.fat,
        mealsLogged: foodLogs.length,
        steps: exerciseData.steps,
        caloriesBurned: exerciseData.calories_burned,
        activeMinutes: exerciseData.active_minutes,
        heartRateAvg: exerciseData.heart_rate_avg,
        plannedCalories: plannedNutrition.calories,
        plannedProtein: plannedNutrition.protein,
        plannedCarbs: plannedNutrition.carbs,
        plannedFat: plannedNutrition.fat,
        breakfastScore: unifiedScoreResult?.breakdown?.nutrition?.breakfast_score || null,
        lunchScore: unifiedScoreResult?.breakdown?.nutrition?.lunch_score || null,
        dinnerScore: unifiedScoreResult?.breakdown?.nutrition?.dinner_score || null,
        calories: {
          consumed: consumedNutrition.calories,
          target: targetCalories
        },
        macros: {
          protein: {
            consumed: consumedNutrition.protein,
            target: macroTargets.protein
          },
          carbs: {
            consumed: consumedNutrition.carbs,
            target: macroTargets.carbs
          },
          fat: {
            consumed: consumedNutrition.fat,
            target: macroTargets.fat
          }
        }
      };

      setData(dashboardData);

      // Process weekly running distance directly from Google Fit sessions
      const [_weeklyNutritionData, _weeklyGoogleFitDataResult] = await weeklyDataPromise;
      let weeklyKm = 0;
      try {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        console.log('🏃 Fetching weekly running distance for week:', weekStartStr, 'user:', user.id);
        const { data: weeklyRunningData, error: weeklyRunningError } = await supabase.functions.invoke('weekly-running-leaderboard', {
          body: { weekStart: weekStartStr, userId: user.id },
        });
        console.log('🏃 Weekly running API response:', weeklyRunningData);
        if (weeklyRunningError) {
          console.error('Error loading weekly running distance for dashboard:', weeklyRunningError);
        } else {
          const entry = (weeklyRunningData as any)?.entries?.find((e: any) => e?.user_id === user.id);
          console.log('🏃 Found entry for user:', entry);
          if (entry) {
            weeklyKm = (Number(entry?.distance_meters) || 0) / 1000;
            console.log('🏃 Weekly kilometers calculated:', weeklyKm);
          } else {
            console.log('🏃 No entry found for user in weekly data');
          }
        }
      } catch (runningError) {
        console.error('Error calculating weekly running distance:', runningError);
      }

      const weeklyTarget = 30; // Default target
      const weeklyGoogle = { current: weeklyKm, target: weeklyTarget };
      setWeeklyGoogleFitData(weeklyGoogle);

      // Write cache with error handling
      try {
        if (user?.id) {
          writeDashboardCache(user.id, {
            daily: {
              data: dashboardData,
              todayScore: unifiedScoreResult?.score || 0,
            },
            weekly: {
              weeklyScore: weeklyScoreResult?.average || 0,
              weeklyKm: weeklyGoogle,
            },
          });
          console.log('Dashboard cache written successfully');
        }
      } catch (cacheError) {
        console.warn('Failed to write dashboard cache:', cacheError);
        // Non-critical error, continue
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      
      // If it's an authentication error, redirect to auth page
      if (error instanceof Error && error.message.includes('Authentication required')) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to continue.",
          variant: "destructive",
        });
        navigate('/auth', { replace: true });
        return;
      }
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

  // Use unified scoring system for meal score
  const nutritionScore = todayBreakdown.nutrition || 0;
  
  // Debug logging
  console.log('🔍 Meal Score Debug:', {
    hasMainMeals,
    nutritionScore,
    todayBreakdown
  });
  
  const mealScore = {
    score: hasMainMeals ? nutritionScore : 0,
    rating: !hasMainMeals ? 'Needs Improvement' as const :
            nutritionScore >= 80 ? 'Excellent' as const :
            nutritionScore >= 65 ? 'Good' as const :
            nutritionScore >= 50 ? 'Fair' as const :
            'Needs Improvement' as const
  };

  // Get upcoming workouts from user data
  const nextWorkout = data?.nextRun ? {
    type: 'Tempo Run',
    date: new Date(data.nextRun),
    distance: 8
  } : undefined;

  // Pre-run meal suggestion with nutrition details
  const preRunMeal = nextWorkout ? {
    food: 'Banana + Almond Butter',
    time: new Date(nextWorkout.date.getTime() - 60 * 60000), // 1 hour before
    calories: 280,
    carbs: 34,
    protein: 8,
    fat: 14,
    notes: [
      'Banana provides quick-release carbs for energy',
      'Almond butter adds healthy fats for sustained energy',
      'Light and easy to digest before running',
      'Aim to finish eating 1 hour before your run'
    ]
  } : undefined;

  // Today's insights
  const insights = [
    {
      icon: 'zap' as const,
      title: 'Pre-Run Nutrition',
      message: nextWorkout 
        ? `Tempo run tomorrow - have your pre-run snack 1 hour before.`
        : 'Plan your pre-run nutrition for optimal performance.',
      color: 'bg-blue-50 dark:bg-blue-900/20',
      details: [
        'Eat 1-2 hours before running',
        'Focus on easily digestible carbs',
        'Include a small amount of protein',
        'Stay hydrated'
      ]
    },
    {
      icon: 'droplets' as const,
      title: 'Hydration Goal',
      message: '2 glasses away from your daily goal. Great progress!',
      color: 'bg-green-50 dark:bg-green-900/20'
    }
  ];

  return (
    <div className="max-w-none mx-auto p-4">
      {/* Header - NutriSync Branding */}
      <div className="flex items-center justify-between">
        <PageHeading
          title="Dashboard"
          description="Your nutrition and training overview"
          icon={Home}
        />
        <div className="flex items-center gap-3" />
      </div>

        {/* Recovery Suggestion */}
        {newActivity && (
          <RecoverySuggestion
            sessionEnd={new Date(parseInt(newActivity.sessionId.split('-')[1]))}
            intensity={newActivity.actual.toLowerCase().includes('tempo') || newActivity.actual.toLowerCase().includes('interval') ? 'high' : 'moderate'}
            duration={60} // TODO: Get from Google Fit session
            distance={parseFloat(newActivity.actual.match(/(\d+\.?\d*)\s*km/)?.[1] || '0')}
            calories_burned={data?.caloriesBurned || 0}
            onDismiss={() => {
              localStorage.setItem('lastAckSessionId', newActivity.sessionId);
              setNewActivity(null);
            }}
            onLogQuick={() => setFoodTrackerOpen(true)}
            onLogFull={() => setFoodTrackerOpen(true)}
          />
        )}

        <FoodTrackerDialog open={foodTrackerOpen} onOpenChange={setFoodTrackerOpen} />

        {/* 1. Today & Weekly Scores */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <ScoreCard 
            title="Daily Score" 
            score={todayScore || 0} 
            subtitle="Today" 
            variant="success" 
            tooltip={
              <>
                <p className="font-semibold">🟢 Daily Score</p>
                <p>Reflects how well you met today&apos;s nutrition and training goals.</p>
                <p>Resets every day to track your daily balance.</p>
              </>
            }
          />
          <ScoreCard 
            title="Weekly Score" 
            score={weeklyScore || 0} 
            subtitle="Mon–Sun avg" 
            variant="warning"
            tooltip={
              <>
                <p className="font-semibold mb-2">⭐ Weekly Score</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Average of daily scores (nutrition + training + bonuses - penalties) from unified scoring system over the past 7 days.
                </p>
                
                <div className="space-y-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="font-medium mb-1">📊 Formula:</p>
                    <p className="text-muted-foreground">
                      Weekly Score = Σ(Daily Scores) / 7 days
                    </p>
                  </div>
                  
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="font-medium mb-1">🏆 Ranking:</p>
                    <p className="text-muted-foreground">
                      Your rank is based on your weekly score, which combines nutrition and training performance. Keep logging meals and completing workouts to climb the leaderboard!
                    </p>
                  </div>
                  
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="font-medium mb-1">💡 Tip:</p>
                    <p className="text-muted-foreground">
                      Curious how we grade each day? <a href="/scoring-explainer" className="text-primary underline">See the scoring explainer</a>.
                    </p>
                  </div>
                </div>
              </>
            }
          />
        </div>

        {/* 2. Marathon Countdown */}
        <div className="mb-5">
          <RaceGoalWidget />
        </div>

        {/* 2.5. Pre-Training Fueling Reminder (appears day before training) */}
        <div className="mb-5">
          <PreTrainingFuelingWidget />
        </div>

        {/* 3. Today's Nutrition Score */}
        <div className="mb-5">
          <TodayMealScoreCard
            score={mealScore.score}
            rating={mealScore.rating}
          />
        </div>

        {/* 4. Today's Nutrition */}
        <div className="mb-5">
          <TodayNutritionCard
            calories={{
              current: data?.calories?.consumed || 0,
              target: data?.calories?.target || 0
            }}
            protein={{
              current: data?.macros?.protein?.consumed || 0,
              target: data?.calories?.target ? deriveMacrosFromCalories(data?.calories?.target).protein : 0,
              color: '#FF6B6B' // Vibrant red/coral for protein
            }}
            carbs={{
              current: data?.macros?.carbs?.consumed || 0,
              target: data?.calories?.target ? deriveMacrosFromCalories(data?.calories?.target).carbs : 0,
              color: '#4ECDC4' // Vibrant teal/cyan for carbs
            }}
            fat={{
              current: data?.macros?.fat?.consumed || 0,
              target: data?.calories?.target ? deriveMacrosFromCalories(data?.calories?.target).fat : 0,
              color: '#FFD93D' // Vibrant yellow for fat
            }}
            showEducation={true}
          />
        </div>

        {/* 5. Weekly Kilometers */}
        <div className="mb-5">
          <WeeklyKilometersCard
            current={weeklyGoogleFitData.current || 0}
            target={weeklyGoogleFitData.target || 30}
          />
        </div>

        {/* 6. Upcoming Workouts */}
        {(nextWorkout || preRunMeal) && (
          <div className="mb-5">
            <UpcomingWorkouts
              workouts={nextWorkout ? [nextWorkout] : []}
              preRunMeal={preRunMeal}
            />
          </div>
        )}

        {/* 7. Today's Insights */}
        <div className="mb-5">
          <TodayInsightsCard insights={insights || []} />
        </div>

        {/* Today's Nutrition Plan removed */}

      </div>
  );
}
