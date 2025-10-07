import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CalorieRing } from '@/components/CalorieRing';
import { Info } from 'lucide-react';

interface MacroData {
  current: number;
  target: number;
  color: string;
}

interface TodayNutritionCardProps {
  calories: {
    current: number;
    target: number;
  };
  protein: MacroData;
  carbs: MacroData;
  fat: MacroData;
  showEducation?: boolean;
}

export function TodayNutritionCard({
  calories,
  protein,
  carbs,
  fat,
  showEducation = false
}: TodayNutritionCardProps) {
  const [openTip, setOpenTip] = useState<null | 'Protein' | 'Carbs' | 'Fat'>(null);
  
  const caloriePercentage = Math.round((calories.current / calories.target) * 100);

  const tips: Record<'Protein' | 'Carbs' | 'Fat', { title: string; points: string[]; target: string }> = {
    Protein: {
      title: 'Why protein builds your runs:',
      points: [
        'Repairs muscle micro-tears from training',
        'Supports recovery and adaptation',
        'Helps maintain lean mass during hard cycles',
        'Improves satiety and stable energy'
      ],
      target: 'Target: 1.2–1.6g per kg body weight'
    },
    Carbs: {
      title: 'Why carbs fuel your runs:',
      points: [
        'Primary fuel for moderate–high intensity',
        'Replenishes muscle glycogen stores',
        'Supports brain function on long efforts',
        'Speeds post‑workout recovery'
      ],
      target: 'Target: 5–10g per kg body weight (by training load)'
    },
    Fat: {
      title: 'Why healthy fats matter:',
      points: [
        'Fuel source for long, easier runs',
        'Reduces training inflammation',
        'Supports hormone production',
        'Aids absorption of fat‑soluble vitamins'
      ],
      target: 'Target: 20–35% of total calories'
    }
  };

  // Replace linear macro bars with circular rings in a horizontal layout

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-4">Today's Nutrition</h3>

        {/* Calories (Circular Ring) */}
        <div className="mb-6">
          <CalorieRing
            baseGoal={calories.target}
            consumed={calories.current}
            exercise={0}
            remaining={Math.max(0, calories.target - calories.current)}
          />
        </div>

        {/* Horizontal Rings: Calories + Macros */}
        <div className="grid grid-cols-4 gap-4">
          <div className="flex flex-col items-center">
            <CalorieRing
              baseGoal={calories.target}
              consumed={calories.current}
              exercise={0}
              remaining={Math.max(0, calories.target - calories.current)}
            />
            <div className="mt-2 text-xs text-muted-foreground">Calories</div>
          </div>
          <div className="flex flex-col items-center">
            <CalorieRing
              baseGoal={protein.target}
              consumed={protein.current}
              exercise={0}
              remaining={Math.max(0, protein.target - protein.current)}
            />
            <div className="mt-2 text-xs text-muted-foreground">Protein</div>
          </div>
          <div className="flex flex-col items-center">
            <CalorieRing
              baseGoal={carbs.target}
              consumed={carbs.current}
              exercise={0}
              remaining={Math.max(0, carbs.target - carbs.current)}
            />
            <div className="mt-2 text-xs text-muted-foreground">Carbs</div>
          </div>
          <div className="flex flex-col items-center">
            <CalorieRing
              baseGoal={fat.target}
              consumed={fat.current}
              exercise={0}
              remaining={Math.max(0, fat.target - fat.current)}
            />
            <div className="mt-2 text-xs text-muted-foreground">Fat</div>
          </div>
        </div>

        {/* Education section removed: Info available via (i) buttons above */}
      </CardContent>
    </Card>
  );
}

