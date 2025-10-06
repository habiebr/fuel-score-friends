import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [showProteinInfo, setShowProteinInfo] = useState(false);
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

  const MacroBar = ({ macro, label }: { macro: MacroData; label: 'Protein' | 'Carbs' | 'Fat' }) => {
    const percentage = Math.round((macro.current / macro.target) * 100);
    
    return (
      <div className="text-center relative">
        <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span>{label}</span>
          <button aria-label={`${label} info`} onClick={() => setOpenTip(openTip === label ? null : label)}>
            <Info className="w-3 h-3" />
          </button>
        </div>
        <div className={`text-2xl font-bold mb-1 ${macro.color}`}>
          {macro.current}g
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          of {macro.target}g
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-black dark:bg-white h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        {openTip === label && (
          <div className="absolute z-20 left-1/2 -translate-x-1/2 mt-2 w-80 text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4">
            <div className="font-semibold text-lg mb-2">{tips[label].title}</div>
            <ul className="text-sm space-y-1 list-disc list-inside text-gray-700 dark:text-gray-300">
              {tips[label].points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <div className="text-sm mt-3 font-medium text-gray-900 dark:text-gray-100">{tips[label].target}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-4">Today's Nutrition</h3>

        {/* Calories */}
        <div className="text-center mb-6">
          <div className="text-5xl font-bold mb-2">{calories.current}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            of {calories.target} kcal
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-black dark:bg-white h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(caloriePercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Macros Grid */}
        <div className="grid grid-cols-3 gap-4">
          <MacroBar macro={protein} label="Protein" />
          <MacroBar macro={carbs} label="Carbs" />
          <MacroBar macro={fat} label="Fat" />
        </div>

        {/* Protein Education Section */}
        {showEducation && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
              onClick={() => setShowProteinInfo(!showProteinInfo)}
            >
              <span className="font-semibold text-base">Why protein matters for runners:</span>
              {showProteinInfo ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>

            {showProteinInfo && (
              <div className="mt-4 space-y-3 text-sm">
                <ul className="space-y-2 list-disc list-inside text-gray-700 dark:text-gray-300">
                  <li>Repairs muscle damage from training</li>
                  <li>Supports recovery between sessions</li>
                  <li>Helps maintain lean muscle mass</li>
                  <li>Provides satiety and stable energy</li>
                </ul>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mt-3">
                  <div className="font-semibold text-blue-900 dark:text-blue-300">
                    Target: 1.2-1.6g per kg body weight
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

