import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Flame, TrendingUp, TrendingDown } from 'lucide-react';

interface CalorieRingProps {
  baseGoal: number;
  consumed: number;
  exercise: number;
  remaining: number;
  className?: string;
}

export function CalorieRing({ baseGoal, consumed, exercise, remaining, className = '' }: CalorieRingProps) {
  const adjustedGoal = baseGoal + exercise;
  const consumedPercent = Math.min((consumed / adjustedGoal) * 100, 100);
  const exercisePercent = (exercise / adjustedGoal) * 100;
  
  // SVG circle calculations
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const consumedOffset = circumference - (consumedPercent / 100) * circumference;
  const exerciseOffset = circumference - (exercisePercent / 100) * circumference;

  const status = useMemo(() => {
    const percentConsumed = (consumed / adjustedGoal) * 100;
    if (percentConsumed < 70) return { color: 'text-orange-500', icon: TrendingDown, message: 'Under goal' };
    if (percentConsumed > 110) return { color: 'text-red-500', icon: TrendingUp, message: 'Over goal' };
    return { color: 'text-green-500', icon: Flame, message: 'On track' };
  }, [consumed, adjustedGoal]);

  const StatusIcon = status.icon;

  return (
    <Card className={`${className} bg-gradient-to-br from-orange-50 to-white dark:from-gray-900 dark:to-gray-800 border-orange-200 dark:border-gray-700`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Daily Calories</h3>
          <div className={`flex items-center gap-1 ${status.color}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="text-xs font-medium">{status.message}</span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          {/* SVG Donut Chart */}
          <div className="relative w-48 h-48">
            <svg className="transform -rotate-90 w-48 h-48">
              {/* Background circle */}
              <circle
                cx="96"
                cy="96"
                r={radius}
                stroke="currentColor"
                strokeWidth="16"
                fill="transparent"
                className="text-gray-200 dark:text-gray-700"
              />
              
              {/* Exercise calories ring (outer) */}
              {exercise > 0 && (
                <circle
                  cx="96"
                  cy="96"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="16"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={exerciseOffset}
                  className="text-blue-400 dark:text-blue-500 opacity-50 transition-all duration-700"
                  strokeLinecap="round"
                />
              )}
              
              {/* Consumed calories ring */}
              <circle
                cx="96"
                cy="96"
                r={radius}
                stroke="currentColor"
                strokeWidth="16"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={consumedOffset}
                className="text-orange-500 dark:text-orange-400 transition-all duration-700"
                strokeLinecap="round"
              />
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {Math.round(remaining)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Remaining
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 w-full">
            <div className="text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Goal</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{Math.round(baseGoal)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-orange-500 dark:text-orange-400 uppercase mb-1">Food</div>
              <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{Math.round(consumed)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-blue-500 dark:text-blue-400 uppercase mb-1">Exercise</div>
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">+{Math.round(exercise)}</div>
            </div>
          </div>

          {/* Formula visualization */}
          <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">{Math.round(baseGoal)}</span>
            <span className="mx-1">-</span>
            <span className="font-medium text-orange-600 dark:text-orange-400">{Math.round(consumed)}</span>
            <span className="mx-1">+</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">{Math.round(exercise)}</span>
            <span className="mx-1">=</span>
            <span className="font-semibold">{Math.round(remaining)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

