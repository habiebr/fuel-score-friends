import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Utensils, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  notes?: string[];
}

interface UpcomingWorkoutsProps {
  workouts?: Workout[];
  preRunMeal?: PreRunMeal;
}

export function UpcomingWorkouts({ workouts = [], preRunMeal }: UpcomingWorkoutsProps) {
  const nextWorkout = workouts[0];
  const [showInsights, setShowInsights] = useState(false);

  return (
    <>
      <Card className="bg-white dark:bg-gray-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-base">Upcoming</h3>
            </div>
            {preRunMeal && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowInsights(true)}
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
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
                      {nextWorkout.distance} km
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
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-white dark:bg-gray-800 mb-1">
                      {preRunMeal.food}
                    </Badge>
                    {preRunMeal.calories && (
                      <div className="text-xs text-muted-foreground">
                        {preRunMeal.calories} kcal
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pre-run Nutrition Insights Dialog */}
      <Dialog open={showInsights} onOpenChange={setShowInsights}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Pre-Run Nutrition Guide</DialogTitle>
            <DialogDescription>
              Optimize your performance with proper pre-run nutrition
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {/* Timing Section */}
            <div className="mb-6">
              <h4 className="font-semibold mb-2 text-blue-600 dark:text-blue-400">Timing</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <span>Eat 1-2 hours before your {nextWorkout?.type.toLowerCase()}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <span>This allows time for proper digestion and energy conversion</span>
                </li>
              </ul>
            </div>

            {/* Nutrition Breakdown */}
            {preRunMeal && (preRunMeal.carbs || preRunMeal.protein || preRunMeal.fat) && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400">Nutrition Profile</h4>
                <div className="grid grid-cols-3 gap-2">
                  {preRunMeal.carbs && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg text-center">
                      <div className="font-semibold">{preRunMeal.carbs}g</div>
                      <div className="text-xs text-muted-foreground">Carbs</div>
                    </div>
                  )}
                  {preRunMeal.protein && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-center">
                      <div className="font-semibold">{preRunMeal.protein}g</div>
                      <div className="text-xs text-muted-foreground">Protein</div>
                    </div>
                  )}
                  {preRunMeal.fat && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-lg text-center">
                      <div className="font-semibold">{preRunMeal.fat}g</div>
                      <div className="text-xs text-muted-foreground">Fat</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Why This Works */}
            <div className="mb-6">
              <h4 className="font-semibold mb-2 text-orange-600 dark:text-orange-400">Why This Works</h4>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 space-y-2 text-sm">
                <p>• Banana provides easily digestible carbs for quick energy</p>
                <p>• Almond butter adds sustainable energy and healthy fats</p>
                <p>• Light and easy to digest before your run</p>
                <p>• Good balance of quick and sustained energy release</p>
              </div>
            </div>

            {/* Additional Tips */}
            {preRunMeal?.notes && preRunMeal.notes.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-2 text-purple-600 dark:text-purple-400">Tips</h4>
                <ul className="space-y-2 text-sm">
                  {preRunMeal.notes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hydration Reminder */}
            <div>
              <h4 className="font-semibold mb-2 text-sky-600 dark:text-sky-400">Hydration</h4>
              <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-3 text-sm">
                <p>Remember to drink 16-20oz of water 2-3 hours before your run, and another 8oz right before starting.</p>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}