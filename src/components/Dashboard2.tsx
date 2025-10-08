import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeading } from '@/components/PageHeading';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Home, 
  Settings, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Activity,
  Utensils,
  Target,
  Calendar,
  Zap,
  Heart,
  Clock,
  Award,
  Info,
  ChefHat,
  Trophy,
  Flame
} from 'lucide-react';
import { format, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { getTodayUnifiedScore } from '@/services/unified-score.service';
import { useGoogleFitSync } from '@/hooks/useGoogleFitSync';

// Enhanced interfaces with better typing
interface DashboardMetrics {
  nutrition: {
    calories: { consumed: number; target: number; percentage: number };
    protein: { consumed: number; target: number; percentage: number };
    carbs: { consumed: number; target: number; percentage: number };
    fat: { consumed: number; target: number; percentage: number };
    mealsLogged: number;
    score: number;
  };
  activity: {
    steps: number;
    caloriesBurned: number;
    activeMinutes: number;
    heartRate: number | null;
    distance: number;
    score: number;
  };
  overall: {
    dailyScore: number;
    weeklyScore: number;
    streak: number;
    lastUpdated: string;
  };
}

interface DashboardState {
  data: DashboardMetrics | null;
  loading: boolean;
  error: string | null;
  lastRefresh: Date | null;
  isRefreshing: boolean;
}

interface DashboardProps {
  onAddMeal?: () => void;
  onAnalyzeFitness?: () => void;
  className?: string;
}

// Custom hooks for better data management
const useDashboardData = (userId: string | undefined) => {
  const [state, setState] = useState<DashboardState>({
    data: null,
    loading: true,
    error: null,
    lastRefresh: null,
    isRefreshing: false
  });

  const { getTodayData } = useGoogleFitSync();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!userId) return;

    try {
      setState(prev => ({ 
        ...prev, 
        loading: !isRefresh, 
        isRefreshing: isRefresh,
        error: null 
      }));

      const today = new Date();
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      // Parallel data fetching for better performance
      const [
        nutritionData,
        activityData,
        scoreData,
        googleFitData
      ] = await Promise.allSettled([
        // Nutrition data
        supabase
          .from('food_logs')
          .select('calories, protein_grams, carbs_grams, fat_grams, meal_type')
          .eq('user_id', userId)
          .gte('logged_at', startOfToday.toISOString())
          .lte('logged_at', endOfToday.toISOString()),
        
        // Activity data
        supabase
          .from('google_fit_data')
          .select('steps, calories_burned, active_minutes, heart_rate_avg, distance_km')
          .eq('user_id', userId)
          .eq('date', format(today, 'yyyy-MM-dd'))
          .single(),
        
        // Score data
        getTodayUnifiedScore(userId),
        
        // Google Fit data
        getTodayData()
      ]);

      // Process nutrition data
      const nutritionResult = nutritionData.status === 'fulfilled' ? nutritionData.value : null;
      const nutritionError = nutritionResult?.error;
      const nutritionLogs = nutritionResult?.data || [];

      const nutritionMetrics = {
        calories: { consumed: 0, target: 2000, percentage: 0 },
        protein: { consumed: 0, target: 150, percentage: 0 },
        carbs: { consumed: 0, target: 250, percentage: 0 },
        fat: { consumed: 0, target: 65, percentage: 0 },
        mealsLogged: 0,
        score: 0
      };

      if (nutritionLogs.length > 0) {
        const totals = nutritionLogs.reduce((acc, log) => ({
          calories: acc.calories + (log.calories || 0),
          protein: acc.protein + (log.protein_grams || 0),
          carbs: acc.carbs + (log.carbs_grams || 0),
          fat: acc.fat + (log.fat_grams || 0)
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

        nutritionMetrics.calories.consumed = Math.round(totals.calories);
        nutritionMetrics.protein.consumed = Math.round(totals.protein);
        nutritionMetrics.carbs.consumed = Math.round(totals.carbs);
        nutritionMetrics.fat.consumed = Math.round(totals.fat);
        nutritionMetrics.mealsLogged = new Set(nutritionLogs.map(log => log.meal_type)).size;
      }

      // Calculate percentages
      nutritionMetrics.calories.percentage = Math.round((nutritionMetrics.calories.consumed / nutritionMetrics.calories.target) * 100);
      nutritionMetrics.protein.percentage = Math.round((nutritionMetrics.protein.consumed / nutritionMetrics.protein.target) * 100);
      nutritionMetrics.carbs.percentage = Math.round((nutritionMetrics.carbs.consumed / nutritionMetrics.carbs.target) * 100);
      nutritionMetrics.fat.percentage = Math.round((nutritionMetrics.fat.consumed / nutritionMetrics.fat.target) * 100);

      // Process activity data
      const activityResult = activityData.status === 'fulfilled' ? activityData.value : null;
      const activityError = activityResult?.error;
      const activity = activityResult?.data;

      const activityMetrics = {
        steps: activity?.steps || 0,
        caloriesBurned: activity?.calories_burned || 0,
        activeMinutes: activity?.active_minutes || 0,
        heartRate: activity?.heart_rate_avg || null,
        distance: activity?.distance_km || 0,
        score: 0
      };

      // Process score data
      const scoreResult = scoreData.status === 'fulfilled' ? scoreData.value : null;
      const scoreError = scoreResult?.error;
      const score = scoreResult?.data;

      const overallMetrics = {
        dailyScore: score?.overallScore || 0,
        weeklyScore: score?.weeklyScore || 0,
        streak: score?.streak || 0,
        lastUpdated: new Date().toISOString()
      };

      // Calculate activity score based on steps
      if (activityMetrics.steps > 0) {
        activityMetrics.score = Math.min(100, Math.round((activityMetrics.steps / 10000) * 100));
      }

      // Calculate nutrition score
      const nutritionScore = Math.round(
        (nutritionMetrics.calories.percentage + 
         nutritionMetrics.protein.percentage + 
         nutritionMetrics.carbs.percentage + 
         nutritionMetrics.fat.percentage) / 4
      );
      nutritionMetrics.score = Math.min(100, nutritionScore);

      const dashboardData: DashboardMetrics = {
        nutrition: nutritionMetrics,
        activity: activityMetrics,
        overall: overallMetrics
      };

      setState(prev => ({
        ...prev,
        data: dashboardData,
        loading: false,
        isRefreshing: false,
        lastRefresh: new Date(),
        error: null
      }));

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        isRefreshing: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data'
      }));
    }
  }, [userId, getTodayData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refresh: () => fetchData(true)
  };
};

// Daily Score Widget Component
const DailyScoreWidget: React.FC<{
  score: number;
  maxScore: number;
  subtitle: string;
  loading?: boolean;
}> = ({ score, maxScore, subtitle, loading = false }) => {
  const percentage = Math.round((score / maxScore) * 100);
  
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20 bg-white/20" />
              <Skeleton className="h-4 w-4 bg-white/20 rounded" />
            </div>
          </div>
          <Skeleton className="h-12 w-16 bg-white/20 mb-2" />
          <Skeleton className="h-3 w-12 bg-white/20 mb-4" />
          <Skeleton className="h-2 w-full bg-white/20 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Daily Score</h3>
            <Info className="h-4 w-4 text-white/70" />
          </div>
        </div>
        <div className="text-4xl font-bold mb-2">{score}/{maxScore}</div>
        <div className="text-sm text-white/80 mb-4">{subtitle}</div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Weekly Score Widget Component
const WeeklyScoreWidget: React.FC<{
  score: number;
  maxScore: number;
  subtitle: string;
  loading?: boolean;
}> = ({ score, maxScore, subtitle, loading = false }) => {
  const percentage = Math.round((score / maxScore) * 100);
  
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-yellow-600 to-orange-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20 bg-white/20" />
              <Skeleton className="h-4 w-4 bg-white/20 rounded" />
            </div>
          </div>
          <Skeleton className="h-12 w-16 bg-white/20 mb-2" />
          <Skeleton className="h-3 w-12 bg-white/20 mb-4" />
          <Skeleton className="h-2 w-full bg-white/20 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-yellow-600 to-orange-600 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Weekly Score</h3>
            <Info className="h-4 w-4 text-white/70" />
          </div>
        </div>
        <div className="text-4xl font-bold mb-2">{score}/{maxScore}</div>
        <div className="text-sm text-white/80 mb-4">{subtitle}</div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
};

// Personal Best Widget Component
const PersonalBestWidget: React.FC<{
  duration: string;
  loading?: boolean;
}> = ({ duration, loading = false }) => {
  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 bg-white/20 rounded" />
              <Skeleton className="h-4 w-24 bg-white/20" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 bg-white/20 rounded" />
              <Skeleton className="h-4 w-16 bg-white/20" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-green-600 to-green-700 text-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-white" />
            <span className="font-medium">Personal Best</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white/70" />
            <span className="text-sm">{duration}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Meal Score Widget Component
const MealScoreWidget: React.FC<{
  score: number;
  status: string;
  explanation: string;
  loading?: boolean;
}> = ({ score, status, explanation, loading = false }) => {
  if (loading) {
    return (
      <Card className="bg-gray-800 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 bg-white/20 rounded" />
              <Skeleton className="h-4 w-32 bg-white/20" />
            </div>
            <Skeleton className="h-6 w-24 bg-white/20 rounded" />
          </div>
          <Skeleton className="h-12 w-16 bg-white/20 mb-2" />
          <Skeleton className="h-3 w-full bg-white/20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-white" />
            <h3 className="text-sm font-medium">Today's Meal Score</h3>
          </div>
          <Badge 
            variant="secondary" 
            className="bg-orange-500 text-white border-0"
          >
            {status}
          </Badge>
        </div>
        <div className="text-4xl font-bold mb-2">{score}%</div>
        <div className="text-sm text-white/70">{explanation}</div>
      </CardContent>
    </Card>
  );
};

// Fuel Status Widget Component
const FuelStatusWidget: React.FC<{
  calories: number;
  target: number;
  percentage: number;
  macros: {
    carbs: { consumed: number; target: number; percentage: number };
    protein: { consumed: number; target: number; percentage: number };
    fat: { consumed: number; target: number; percentage: number };
  };
  loading?: boolean;
}> = ({ calories, target, percentage, macros, loading = false }) => {
  if (loading) {
    return (
      <Card className="bg-gray-800 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Skeleton className="h-6 w-20 bg-white/20 mb-1" />
              <Skeleton className="h-3 w-32 bg-white/20" />
            </div>
            <Skeleton className="h-6 w-12 bg-white/20 rounded" />
          </div>
          <div className="flex justify-center mb-4">
            <Skeleton className="h-32 w-32 bg-white/20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-48 bg-white/20 mb-4" />
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-20 bg-white/20 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 text-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Nutrition</h3>
            <p className="text-xs text-white/70 uppercase tracking-wide">TODAY'S FUEL STATUS</p>
          </div>
          <Badge 
            variant="secondary" 
            className="bg-green-500 text-white border-0"
          >
            {percentage}%
          </Badge>
        </div>
        
        {/* Circular Progress */}
        <div className="flex justify-center mb-4">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#fbbf24"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - percentage / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold">{calories}</div>
              <div className="text-xs text-white/70">KCAL</div>
            </div>
          </div>
        </div>
        
        <div className="text-center text-sm text-white/70 mb-6">
          of {target} target
        </div>
        
        <div className="text-center text-xs text-white/70 mb-6">
          Goal - Food + Exercise = Remaining <Info className="h-3 w-3 inline ml-1" />
        </div>
        
        {/* Macronutrient Pills */}
        <div className="flex gap-4 justify-center">
          <div className="flex-1 max-w-20">
            <div className="bg-blue-500/20 rounded-full p-3 text-center relative overflow-hidden">
              <div className="text-lg font-bold">{macros.carbs.consumed}g</div>
              <div className="text-xs text-white/70">Carbs</div>
              <div 
                className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-full transition-all duration-300"
                style={{ height: `${Math.min(100, macros.carbs.percentage)}%` }}
              />
            </div>
          </div>
          <div className="flex-1 max-w-20">
            <div className="bg-green-500/20 rounded-full p-3 text-center relative overflow-hidden">
              <div className="text-lg font-bold">{macros.protein.consumed}g</div>
              <div className="text-xs text-white/70">Protein</div>
              <div 
                className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-full transition-all duration-300"
                style={{ height: `${Math.min(100, macros.protein.percentage)}%` }}
              />
            </div>
          </div>
          <div className="flex-1 max-w-20">
            <div className="bg-yellow-500/20 rounded-full p-3 text-center relative overflow-hidden">
              <div className="text-lg font-bold">{macros.fat.consumed}g</div>
              <div className="text-xs text-white/70">Fat</div>
              <div 
                className="absolute bottom-0 left-0 right-0 bg-yellow-500 rounded-full transition-all duration-300"
                style={{ height: `${Math.min(100, macros.fat.percentage)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Metric card component
const MetricCard: React.FC<{
  title: string;
  value: number | string;
  target?: number;
  unit?: string;
  percentage?: number;
  icon: React.ReactNode;
  color?: 'default' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}> = ({ title, value, target, unit, percentage, icon, color = 'default', loading = false }) => {
  const getColorClasses = () => {
    switch (color) {
      case 'success': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'warning': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'danger': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  if (loading) {
    return (
      <Card className="h-32">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-32 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <div className={`p-2 rounded-full ${getColorClasses()}`}>
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
        </div>
        {target && (
          <div className="text-xs text-muted-foreground">
            Target: {target.toLocaleString()}{unit}
          </div>
        )}
        {percentage !== undefined && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  percentage >= 100 ? 'bg-green-500' : 
                  percentage >= 75 ? 'bg-blue-500' : 
                  percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Dashboard2 component
export const Dashboard2: React.FC<DashboardProps> = ({ 
  onAddMeal, 
  onAnalyzeFitness, 
  className = '' 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const {
    data,
    loading,
    error,
    lastRefresh,
    isRefreshing,
    refresh
  } = useDashboardData(user?.id);

  const handleRefresh = useCallback(async () => {
    await refresh();
    toast({
      title: "Dashboard refreshed",
      description: "Latest data has been loaded",
    });
  }, [refresh, toast]);

  const handleAddMeal = useCallback(() => {
    if (onAddMeal) {
      onAddMeal();
    } else {
      navigate('/meals');
    }
  }, [onAddMeal, navigate]);

  const handleAnalyzeFitness = useCallback(() => {
    if (onAnalyzeFitness) {
      onAnalyzeFitness();
    } else {
      navigate('/training-calendar');
    }
  }, [onAnalyzeFitness, navigate]);

  // Memoized quick actions
  const quickActions = useMemo(() => [
    {
      title: 'Log Meal',
      description: 'Track your nutrition',
      icon: <Utensils className="h-5 w-5" />,
      onClick: handleAddMeal,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      title: 'View Training',
      description: 'Check your workouts',
      icon: <Activity className="h-5 w-5" />,
      onClick: handleAnalyzeFitness,
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      title: 'Set Goals',
      description: 'Update your targets',
      icon: <Target className="h-5 w-5" />,
      onClick: () => navigate('/goals'),
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      title: 'View Calendar',
      description: 'See your schedule',
      icon: <Calendar className="h-5 w-5" />,
      onClick: () => navigate('/training-calendar'),
      color: 'bg-orange-500 hover:bg-orange-600'
    }
  ], [handleAddMeal, handleAnalyzeFitness, navigate]);

  if (loading && !data) {
    return (
      <div className={`min-h-screen bg-gray-900 p-4 pb-28 safe-area-inset ${className}`}>
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <DailyScoreWidget
              score={0}
              maxScore={100}
              subtitle="Today"
              loading={true}
            />
            <WeeklyScoreWidget
              score={0}
              maxScore={100}
              subtitle="Mon-Sun avg"
              loading={true}
            />
          </div>
          <PersonalBestWidget
            duration="83d 6h 53m"
            loading={true}
          />
          <div className="mt-6">
            <MealScoreWidget
              score={0}
              status="Loading..."
              explanation="Loading..."
              loading={true}
            />
          </div>
          <div className="mt-6">
            <FuelStatusWidget
              calories={0}
              target={2465}
              percentage={0}
              macros={{
                carbs: { consumed: 0, target: 250, percentage: 0 },
                protein: { consumed: 0, target: 150, percentage: 0 },
                fat: { consumed: 0, target: 65, percentage: 0 }
              }}
              loading={true}
            />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-gray-900 p-4 pb-28 safe-area-inset ${className}`}>
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-2"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Retry'}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`min-h-screen bg-gray-900 p-4 pb-28 safe-area-inset ${className}`}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <p className="text-white">No data available</p>
            <Button onClick={handleRefresh} className="mt-4">
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-900 p-4 pb-28 safe-area-inset ${className}`}>
      <div className="max-w-4xl mx-auto">

        {/* Score Widgets Section */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <DailyScoreWidget
              score={data.overall.dailyScore}
              maxScore={100}
              subtitle="Today"
              loading={loading}
            />
            <WeeklyScoreWidget
              score={data.overall.weeklyScore}
              maxScore={100}
              subtitle="Mon-Sun avg"
              loading={loading}
            />
          </div>
          
          {/* Personal Best Section */}
          <PersonalBestWidget
            duration="83d 6h 53m"
            loading={loading}
          />
        </div>

        {/* Meal Score Widget */}
        <div className="mb-6">
          <MealScoreWidget
            score={data.nutrition.score}
            status={data.nutrition.score >= 80 ? "Excellent" : data.nutrition.score >= 60 ? "Good" : "Needs Improvement"}
            explanation="Based on macro targets and meal timing"
            loading={loading}
          />
        </div>

        {/* Fuel Status Widget */}
        <div className="mb-6">
          <FuelStatusWidget
            calories={data.nutrition.calories.consumed}
            target={data.nutrition.calories.target}
            percentage={data.nutrition.calories.percentage}
            macros={{
              carbs: data.nutrition.carbs,
              protein: data.nutrition.protein,
              fat: data.nutrition.fat
            }}
            loading={loading}
          />
        </div>

      </div>
    </div>
  );
};

export default Dashboard2;
