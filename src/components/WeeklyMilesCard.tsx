import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface WeeklyMilesCardProps {
  current: number;
  target: number;
}

export function WeeklyMilesCard({ current, target }: WeeklyMilesCardProps) {
  const percentage = Math.round((current / target) * 100);

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="font-semibold text-base">Weekly Miles</h3>
          </div>
          <Badge variant="secondary" className="bg-gray-100 dark:bg-gray-700">
            {percentage}%
          </Badge>
        </div>

        <div className="flex items-end gap-3">
          <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
            {current.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 pb-2">
            of {target} miles
          </div>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-3">
          <div
            className="bg-black dark:bg-white h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

