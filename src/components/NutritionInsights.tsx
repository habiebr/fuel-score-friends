import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, TrendingUp, AlertCircle, CheckCircle, Flame, Droplets } from 'lucide-react';

interface NutritionInsightsProps {
  calories: { consumed: number; target: number; exercise: number };
  macros: {
    protein: { consumed: number; target: number };
    carbs: { consumed: number; target: number };
    fat: { consumed: number; target: number };
  };
  runningGoal?: string;
  trainingIntensity?: string;
  hydrationMl?: number;
  className?: string;
}

export function NutritionInsights({
  calories,
  macros,
  runningGoal = 'general',
  trainingIntensity = 'moderate',
  hydrationMl = 0,
  className = '',
}: NutritionInsightsProps) {
  const insights = useMemo(() => {
    const results: Array<{
      type: 'success' | 'warning' | 'info' | 'error';
      icon: any;
      message: string;
      tip?: string;
    }> = [];

    // Calorie analysis
    const calorieDeficit = calories.target + calories.exercise - calories.consumed;
    const caloriePercent = (calories.consumed / (calories.target + calories.exercise)) * 100;

    if (caloriePercent < 70) {
      results.push({
        type: 'warning',
        icon: AlertCircle,
        message: 'Calorie intake is low for your training',
        tip: 'Consider adding a nutrient-dense snack to meet your energy needs.',
      });
    } else if (caloriePercent >= 95 && caloriePercent <= 105) {
      results.push({
        type: 'success',
        icon: CheckCircle,
        message: 'Perfect calorie balance for your training!',
        tip: 'Your energy intake matches your activity level.',
      });
    } else if (caloriePercent > 110) {
      results.push({
        type: 'info',
        icon: TrendingUp,
        message: 'Slightly above calorie target',
        tip: 'This is fine for recovery days or if you ran longer than planned.',
      });
    }

    // Protein analysis for runners
    const proteinPerKg = macros.protein.consumed / 70; // Assuming ~70kg average
    if (proteinPerKg < 1.2 && (runningGoal === 'marathon' || trainingIntensity === 'high')) {
      results.push({
        type: 'warning',
        icon: Flame,
        message: 'Protein intake may be low for endurance training',
        tip: 'Aim for 1.2-1.6g per kg body weight to support muscle recovery.',
      });
    } else if (macros.protein.consumed >= macros.protein.target * 0.9) {
      results.push({
        type: 'success',
        icon: CheckCircle,
        message: 'Great protein intake for recovery!',
      });
    }

    // Carbs analysis for runners
    const carbPercent = (macros.carbs.consumed / macros.carbs.target) * 100;
    if (carbPercent < 70 && (runningGoal === 'marathon' || trainingIntensity === 'high')) {
      results.push({
        type: 'warning',
        icon: AlertCircle,
        message: 'Carb intake is low for endurance training',
        tip: 'Runners need 5-7g carbs per kg body weight for optimal glycogen stores.',
      });
    } else if (carbPercent >= 90) {
      results.push({
        type: 'success',
        icon: CheckCircle,
        message: 'Excellent carb fueling for your runs!',
      });
    }

    // Hydration insights
    const recommendedHydration = 2000 + (calories.exercise * 3); // ~3ml per calorie burned
    if (hydrationMl > 0) {
      if (hydrationMl < recommendedHydration * 0.7) {
        results.push({
          type: 'warning',
          icon: Droplets,
          message: 'Hydration could be better',
          tip: `Aim for ${Math.round(recommendedHydration / 1000)}L today based on your activity.`,
        });
      } else if (hydrationMl >= recommendedHydration * 0.9) {
        results.push({
          type: 'success',
          icon: Droplets,
          message: 'Great hydration! 💧',
        });
      }
    }

    // Running-specific timing advice
    if (trainingIntensity === 'high' || runningGoal === 'marathon') {
      results.push({
        type: 'info',
        icon: Lightbulb,
        message: 'Pre-run fuel tip',
        tip: 'Eat a carb-rich meal 2-3 hours before your long run for sustained energy.',
      });
    }

    // Recovery window advice is now handled by RecoverySuggestion component

    return results;
  }, [calories, macros, runningGoal, trainingIntensity, hydrationMl]);

  const typeStyles = {
    success: {
      border: 'border-green-200 dark:border-green-800',
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
      badge: 'bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200',
    },
    warning: {
      border: 'border-orange-200 dark:border-orange-800',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-300',
      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-200',
    },
    info: {
      border: 'border-blue-200 dark:border-blue-800',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200',
    },
    error: {
      border: 'border-red-200 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      badge: 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200',
    },
  };

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card className={`${className} bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Runner Insights
          </h3>
        </div>

        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            const styles = typeStyles[insight.type];

            return (
              <div
                key={index}
                className={`p-4 rounded-lg border ${styles.border} ${styles.bg} transition-all duration-300`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${styles.text}`} />
                  <div className="flex-1">
                    <p className={`font-medium ${styles.text} mb-1`}>{insight.message}</p>
                    {insight.tip && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{insight.tip}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className={`${styles.badge} text-xs`}>
                    {insight.type === 'success' ? '✓' : insight.type === 'warning' ? '!' : 'i'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

