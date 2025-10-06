import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Utensils } from 'lucide-react';
import { format } from 'date-fns';

interface Workout {
  type: string;
  date: Date;
  distance?: number;
  duration?: number;
}

interface PreRunMeal {
  food: string;
  time: Date;
}

interface UpcomingWorkoutsProps {
  workouts?: Workout[];
  preRunMeal?: PreRunMeal;
}

export function UpcomingWorkouts({ workouts = [], preRunMeal }: UpcomingWorkoutsProps) {
  const nextWorkout = workouts[0];

  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-base">Upcoming</h3>
        </div>

        <div className="space-y-3">
          {/* Next Workout */}
          {nextWorkout && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-base mb-1">{nextWorkout.type}</div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{format(nextWorkout.date, 'EEEE h:mm a')}</span>
                  </div>
                </div>
                {nextWorkout.distance && (
                  <Badge variant="outline" className="text-sm">
                    {nextWorkout.distance} miles
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Pre-run Meal */}
          {preRunMeal && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-base mb-1">Pre-run Snack</div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{format(preRunMeal.time, 'EEEE h:mm a')}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white dark:bg-gray-800">
                  {preRunMeal.food}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

