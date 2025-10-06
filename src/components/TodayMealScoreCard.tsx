import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';

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
            <div className="text-4xl font-bold mb-2">{score}%</div>
            <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-black dark:bg-white h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
          <div className="text-right text-sm text-gray-600 dark:text-gray-400 leading-tight max-w-[140px]">
            Based on macro targets and meal timing
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

