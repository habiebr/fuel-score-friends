import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Beef, Wheat, Droplet } from 'lucide-react';

interface MacroData {
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
}

interface MacroProgressBarsProps {
  data: MacroData;
  className?: string;
}

export function MacroProgressBars({ data, className = '' }: MacroProgressBarsProps) {
  const macros = [
    {
      name: 'Protein',
      icon: Beef,
      consumed: data.protein.consumed,
      target: data.protein.target,
      color: 'bg-red-500',
      lightColor: 'bg-red-100 dark:bg-red-900/20',
      textColor: 'text-red-600 dark:text-red-400',
      unit: 'g',
    },
    {
      name: 'Carbs',
      icon: Wheat,
      consumed: data.carbs.consumed,
      target: data.carbs.target,
      color: 'bg-amber-500',
      lightColor: 'bg-amber-100 dark:bg-amber-900/20',
      textColor: 'text-amber-600 dark:text-amber-400',
      unit: 'g',
    },
    {
      name: 'Fat',
      icon: Droplet,
      consumed: data.fat.consumed,
      target: data.fat.target,
      color: 'bg-blue-500',
      lightColor: 'bg-blue-100 dark:bg-blue-900/20',
      textColor: 'text-blue-600 dark:text-blue-400',
      unit: 'g',
    },
  ];

  return (
    <Card className={`${className} bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700`}>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Macronutrients
        </h3>

        <div className="space-y-6">
          {macros.map((macro) => {
            const percentage = Math.min((macro.consumed / macro.target) * 100, 100);
            const remaining = Math.max(0, macro.target - macro.consumed);
            const Icon = macro.icon;

            return (
              <div key={macro.name} className="space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${macro.lightColor}`}>
                      <Icon className={`w-4 h-4 ${macro.textColor}`} />
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {macro.name}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    <span className={macro.textColor}>{Math.round(macro.consumed)}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-gray-500 dark:text-gray-400">{Math.round(macro.target)}</span>
                    <span className="text-gray-400 ml-1">{macro.unit}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${macro.color} transition-all duration-700 ease-out rounded-full`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {Math.round(percentage)}% complete
                  </span>
                  <span className={`font-medium ${remaining > 0 ? 'text-gray-600 dark:text-gray-300' : 'text-green-600 dark:text-green-400'}`}>
                    {remaining > 0 ? `${Math.round(remaining)}${macro.unit} remaining` : 'Goal met! 🎉'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Total consumed</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {Math.round(
                data.protein.consumed * 4 + data.carbs.consumed * 4 + data.fat.consumed * 9
              )}{' '}
              <span className="text-gray-500 dark:text-gray-400 font-normal">cal</span>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

