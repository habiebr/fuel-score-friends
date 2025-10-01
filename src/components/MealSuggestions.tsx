import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronRight, Check } from 'lucide-react';
import { useState } from 'react';

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
}

interface MealSuggestionsProps {
  mealPlans: MealPlan[];
  actualMeals?: { [key: string]: { calories: number; protein: number; carbs: number; fat: number } };
}

export function MealSuggestions({ mealPlans, actualMeals = {} }: MealSuggestionsProps) {
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  const getMealIcon = (mealType: string) => {
    const icons: { [key: string]: string } = {
      breakfast: '🍳',
      lunch: '🥗',
      dinner: '🍽️',
    };
    return icons[mealType] || '🍴';
  };

  const isCompleted = (mealType: string) => {
    return actualMeals[mealType]?.calories > 0;
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Meal Suggestions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Personalized meal ideas based on your activity and goals
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {mealPlans.map((plan) => {
          const isExpanded = expandedMeal === plan.meal_type;
          const completed = isCompleted(plan.meal_type);
          const actual = actualMeals[plan.meal_type];

          return (
            <div
              key={plan.meal_type}
              className={`border rounded-lg overflow-hidden transition-all ${
                completed ? 'border-success/50 bg-success/5' : 'border-border'
              }`}
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedMeal(isExpanded ? null : plan.meal_type)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getMealIcon(plan.meal_type)}</span>
                    <div>
                      <div className="font-semibold capitalize flex items-center gap-2">
                        {plan.meal_type}
                        {completed && <Check className="h-4 w-4 text-success" />}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Target: {plan.recommended_calories} cal
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {/* Comparison when completed */}
                {completed && actual && (
                  <div className="mt-3 p-2 bg-background rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Target</div>
                        <div className="font-medium">
                          {plan.recommended_calories} cal | P:{plan.recommended_protein_grams}g C:
                          {plan.recommended_carbs_grams}g F:{plan.recommended_fat_grams}g
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Actual</div>
                        <div className="font-medium text-success">
                          {actual.calories} cal | P:{actual.protein}g C:{actual.carbs}g F:{actual.fat}g
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded suggestions */}
              {isExpanded && plan.meal_suggestions && plan.meal_suggestions.length > 0 && (
                <div className="border-t bg-muted/20 p-4 space-y-3">
                  <div className="text-sm font-semibold mb-2">Suggested Options:</div>
                  {plan.meal_suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-background border border-border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <div className="font-medium text-sm mb-1">{suggestion.name}</div>
                      {suggestion.description && (
                        <p className="text-xs text-muted-foreground mb-2">{suggestion.description}</p>
                      )}
                      {suggestion.foods && suggestion.foods.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {suggestion.foods.map((food, foodIdx) => (
                            <span
                              key={foodIdx}
                              className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                            >
                              {food}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">Calories</div>
                          <div className="font-semibold">{suggestion.calories}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Protein</div>
                          <div className="font-semibold text-success">{suggestion.protein}g</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Carbs</div>
                          <div className="font-semibold text-warning">{suggestion.carbs}g</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Fat</div>
                          <div className="font-semibold text-info">{suggestion.fat}g</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
