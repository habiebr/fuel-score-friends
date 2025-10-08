import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface MealSuggestion {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prep_time?: number;
  ingredients?: string[];
}

interface MealSuggestionsCarouselProps {
  suggestions: MealSuggestion[];
  mealType: string;
  onAddToDiary: (suggestion: MealSuggestion) => void;
}

export function MealSuggestionsCarousel({ 
  suggestions, 
  mealType, 
  onAddToDiary 
}: MealSuggestionsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  const nextSuggestion = () => {
    setCurrentIndex((prev) => (prev + 1) % suggestions.length);
  };

  const prevSuggestion = () => {
    setCurrentIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
  };

  const currentSuggestion = suggestions[currentIndex];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Alternative {mealType} suggestions
        </h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prevSuggestion}
            disabled={suggestions.length <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {suggestions.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={nextSuggestion}
            disabled={suggestions.length <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h5 className="font-medium text-foreground mb-1">
                {currentSuggestion.name}
              </h5>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {currentSuggestion.prep_time || 10} min
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-foreground">
                {currentSuggestion.calories} kcal
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded-lg py-2">
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {currentSuggestion.protein}g
              </div>
              <div className="text-xs text-muted-foreground">Protein</div>
            </div>
            <div className="text-center bg-green-50 dark:bg-green-900/20 rounded-lg py-2">
              <div className="text-sm font-bold text-green-600 dark:text-green-400">
                {currentSuggestion.carbs}g
              </div>
              <div className="text-xs text-muted-foreground">Carbs</div>
            </div>
            <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-lg py-2">
              <div className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                {currentSuggestion.fat}g
              </div>
              <div className="text-xs text-muted-foreground">Fat</div>
            </div>
          </div>

          {currentSuggestion.ingredients && currentSuggestion.ingredients.length > 0 && (
            <div className="mb-3 text-xs text-muted-foreground">
              <strong>Ingredients:</strong> {currentSuggestion.ingredients.join(', ')}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddToDiary(currentSuggestion)}
            className="w-full"
          >
            Add to Food Diary
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
