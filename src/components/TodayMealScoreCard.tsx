import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TodayMealScoreCardProps {
  score: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
}

export function TodayMealScoreCard({ score, rating }: TodayMealScoreCardProps) {
  const getRatingColor = () => {
    switch (rating) {
      case 'Excellent': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Good': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Fair': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default: return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    }
  };

  const getProgressBarColor = () => {
    switch (rating) {
      case 'Excellent': return 'bg-gradient-to-r from-green-500 to-emerald-600';
      case 'Good': return 'bg-gradient-to-r from-blue-500 to-cyan-600';
      case 'Fair': return 'bg-gradient-to-r from-yellow-500 to-amber-600';
      default: return 'bg-gradient-to-r from-orange-500 to-red-500';
    }
  };

  const getScoreTextColor = () => {
    switch (rating) {
      case 'Excellent': return 'text-green-600 dark:text-green-400';
      case 'Good': return 'text-blue-600 dark:text-blue-400';
      case 'Fair': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-orange-600 dark:text-orange-400';
    }
  };

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-semibold text-base">Today's Meal Score</h3>
          </div>
          <Badge className={getRatingColor()}>
            {rating}
          </Badge>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className={`text-4xl font-bold mb-2 ${getScoreTextColor()}`}>{score}%</div>
            <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`${getProgressBarColor()} h-2.5 rounded-full transition-all duration-500 shadow-sm`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
          <div className="text-right text-sm text-gray-600 dark:text-gray-400 leading-tight max-w-[140px]">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    type="button"
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                    aria-label="Meal score info"
                  >
                    <Info className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-sm">
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold">🍽️ Today's Meal Score</p>
                    <p>Measures how well your nutrition matched your targets:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Macro alignment (carbs, protein, fat within ±5-10%)</li>
                      <li>Timing (pre/post-run fueling windows)</li>
                      <li>Meal structure (balanced distribution through the day)</li>
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

