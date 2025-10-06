import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ThumbsUp } from 'lucide-react';

interface WeeklyScoreCardProps {
  weeklyScore: number;
  macroBalance: number;
  mealTiming: number;
  message?: string;
}

export function WeeklyScoreCard({ 
  weeklyScore, 
  macroBalance, 
  mealTiming,
  message = "Good consistency, keep it up!"
}: WeeklyScoreCardProps) {
  return (
    <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-lg">Weekly Score</h3>
          </div>
          <Badge className="bg-yellow-600 hover:bg-yellow-700 text-white text-lg px-3 py-1">
            {weeklyScore}
          </Badge>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Macro Balance */}
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Macro Balance
            </div>
            <div className="text-3xl font-bold mb-2">{macroBalance}</div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-black dark:bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${macroBalance}%` }}
              />
            </div>
          </div>

          {/* Meal Timing */}
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Meal Timing
            </div>
            <div className="text-3xl font-bold mb-2">{mealTiming}</div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-black dark:bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${mealTiming}%` }}
              />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <ThumbsUp className="w-4 h-4" />
          <span>{message}</span>
        </div>
      </CardContent>
    </Card>
  );
}

