import { AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MealScoreSuggestionsProps {
  score: number;
  breakdown?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  actual?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  target?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  mealsLogged?: number;
}

export function MealScoreSuggestions({
  score,
  breakdown = { calories: 0, protein: 0, carbs: 0, fat: 0 },
  actual = { calories: 0, protein: 0, carbs: 0, fat: 0 },
  target = { calories: 0, protein: 0, carbs: 0, fat: 0 },
  mealsLogged = 0,
}: MealScoreSuggestionsProps) {
  const suggestions: { priority: 'high' | 'medium' | 'low'; message: string; hint: string }[] = [];

  // Check if no meals logged
  if (mealsLogged === 0) {
    suggestions.push({
      priority: 'high',
      message: '📋 Log Your Meals',
      hint: 'Start by logging what you ate today. This helps us track your nutrition and provide accurate scoring.',
    });
    return <SuggestionsCard suggestions={suggestions} score={score} />;
  }

  // Check calories (most important for overall energy)
  if (breakdown.calories < 40) {
    suggestions.push({
      priority: 'high',
      message: '🔋 Increase Calorie Intake',
      hint: `You're ${Math.round(target.calories - actual.calories)} kcal below target. Add an extra snack or increase portion sizes.`,
    });
  } else if (breakdown.calories < 70) {
    suggestions.push({
      priority: 'medium',
      message: '⚡ Close the Calorie Gap',
      hint: `Almost there! You need about ${Math.round(target.calories - actual.calories)} more calories. Try a banana, granola bar, or sports drink.`,
    });
  }

  // Check carbs (critical for runners)
  if (breakdown.carbs < 40) {
    suggestions.push({
      priority: 'high',
      message: '🍚 Boost Carbohydrates',
      hint: 'Carbs are your primary fuel source. Add pasta, rice, bread, or fruit to your meals.',
    });
  } else if (breakdown.carbs < 70) {
    suggestions.push({
      priority: 'medium',
      message: '🌾 Add More Carbs',
      hint: 'A little more carbohydrate will help fuel your training better. Consider an extra serving of grains.',
    });
  }

  // Check protein (muscle repair & recovery)
  if (breakdown.protein < 40) {
    suggestions.push({
      priority: 'high',
      message: '💪 Increase Protein',
      hint: 'You need more protein for muscle recovery. Add chicken, fish, eggs, yogurt, or beans.',
    });
  } else if (breakdown.protein < 70) {
    suggestions.push({
      priority: 'medium',
      message: '🥚 More Protein Helps',
      hint: 'A bit more protein will aid recovery. Try Greek yogurt, cottage cheese, or a protein shake.',
    });
  }

  // Check fat (essential for hormones & health)
  if (breakdown.fat < 40) {
    suggestions.push({
      priority: 'high',
      message: '🫒 Add Healthy Fats',
      hint: 'Include olive oil, nuts, avocado, or fatty fish. These support hormone production.',
    });
  } else if (breakdown.fat < 70) {
    suggestions.push({
      priority: 'medium',
      message: '🥑 Boost Healthy Fats',
      hint: 'A little more fat will improve nutrient absorption. Try nuts, olive oil, or seeds.',
    });
  }

  // Meal structure suggestions
  if (mealsLogged === 1 && score < 80) {
    suggestions.push({
      priority: 'medium',
      message: '🍽️ Spread Meals Throughout Day',
      hint: 'Logging multiple meals (breakfast, lunch, dinner) helps maintain energy levels and recovery.',
    });
  }

  // Positive reinforcement for good scores
  if (score >= 80) {
    suggestions.push({
      priority: 'low',
      message: '🎯 Great Job!',
      hint: 'Your nutrition is on track! Keep up this consistency to maximize your training results.',
    });
  } else if (score >= 65) {
    suggestions.push({
      priority: 'low',
      message: '✨ Good Balance',
      hint: 'You\'re doing well. Small tweaks to hit your targets will boost your performance.',
    });
  }

  return <SuggestionsCard suggestions={suggestions} score={score} />;
}

interface SuggestionsCardProps {
  suggestions: { priority: 'high' | 'medium' | 'low'; message: string; hint: string }[];
  score: number;
}

function SuggestionsCard({ suggestions, score }: SuggestionsCardProps) {
  if (suggestions.length === 0) return null;

  // Sort by priority: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...suggestions].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Show top 2-3 suggestions
  const topSuggestions = sorted.slice(0, score < 50 ? 3 : 2);

  return (
    <Card className="shadow-card border-amber-200 dark:border-amber-900/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
      <CardContent className="p-4">
        <div className="space-y-3">
          {topSuggestions.map((suggestion, idx) => (
            <div key={idx} className="flex gap-3">
              <div className="flex-shrink-0 pt-0.5">
                {suggestion.priority === 'high' ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : suggestion.priority === 'medium' ? (
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{suggestion.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{suggestion.hint}</p>
              </div>
            </div>
          ))}
        </div>

        {topSuggestions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-900/30">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Tip:</strong> Hit your nutrition targets consistently to improve your daily score and maximize training benefits.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
