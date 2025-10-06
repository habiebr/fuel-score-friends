import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Droplets, Plus, Minus, Cup } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface HydrationTrackerProps {
  exerciseCalories?: number;
  className?: string;
}

const GLASS_SIZES = [
  { label: 'Small', ml: 250, icon: '🥃' },
  { label: 'Medium', ml: 500, icon: '🥤' },
  { label: 'Large', ml: 750, icon: '🍶' },
];

export function HydrationTracker({ exerciseCalories = 0, className = '' }: HydrationTrackerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hydrationMl, setHydrationMl] = useState(0);
  const [loading, setLoading] = useState(true);

  // Calculate daily goal: base 2L + 3ml per calorie burned
  const dailyGoalMl = 2000 + (exerciseCalories * 3);
  const percentage = Math.min((hydrationMl / dailyGoalMl) * 100, 100);

  useEffect(() => {
    if (user) {
      loadHydrationData();
    }
  }, [user]);

  const loadHydrationData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('hydration_logs')
        .select('amount_ml')
        .eq('user_id', user.id)
        .gte('logged_at', `${today}T00:00:00`)
        .lte('logged_at', `${today}T23:59:59`);

      if (error) throw error;

      const total = (data || []).reduce((sum, log) => sum + (log.amount_ml || 0), 0);
      setHydrationMl(total);
    } catch (error) {
      console.error('Error loading hydration:', error);
    } finally {
      setLoading(false);
    }
  };

  const addHydration = async (ml: number) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('hydration_logs').insert({
        user_id: user.id,
        amount_ml: ml,
        logged_at: new Date().toISOString(),
      });

      if (error) throw error;

      setHydrationMl((prev) => prev + ml);
      toast({
        title: 'Hydration logged!',
        description: `Added ${ml}ml to your daily intake.`,
      });
    } catch (error) {
      console.error('Error adding hydration:', error);
      toast({
        title: 'Error',
        description: 'Failed to log hydration.',
        variant: 'destructive',
      });
    }
  };

  const removeHydration = async (ml: number) => {
    if (!user || hydrationMl < ml) return;

    setHydrationMl((prev) => Math.max(0, prev - ml));
    toast({
      description: `Removed ${ml}ml from your daily intake.`,
    });
  };

  if (loading) {
    return (
      <Card className={`${className} bg-white dark:bg-gray-800`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const glassesConsumed = Math.floor(hydrationMl / 250);
  const remainingMl = Math.max(0, dailyGoalMl - hydrationMl);

  return (
    <Card className={`${className} bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-800`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Hydration
            </h3>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Goal: {(dailyGoalMl / 1000).toFixed(1)}L
          </div>
        </div>

        {/* Water Level Visualization */}
        <div className="relative mb-6">
          <div className="h-24 w-full bg-white dark:bg-gray-800 rounded-lg border-2 border-blue-300 dark:border-blue-700 overflow-hidden relative">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-cyan-400 transition-all duration-700 ease-out"
              style={{ height: `${percentage}%` }}
            >
              <div className="absolute inset-0 opacity-20 bg-wave-pattern animate-wave"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 z-10 bg-white/80 dark:bg-gray-800/80 px-3 py-1 rounded">
                {(hydrationMl / 1000).toFixed(1)}L
              </div>
            </div>
          </div>
          <div className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {percentage.toFixed(0)}% of daily goal
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {GLASS_SIZES.map((size) => (
            <Button
              key={size.label}
              variant="outline"
              size="sm"
              onClick={() => addHydration(size.ml)}
              className="flex flex-col items-center gap-1 h-auto py-3 border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              <span className="text-2xl">{size.icon}</span>
              <span className="text-xs font-medium">{size.ml}ml</span>
            </Button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-200 dark:border-blue-700">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
              Consumed
            </div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {glassesConsumed} 🥤
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
              Remaining
            </div>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {(remainingMl / 1000).toFixed(1)}L
            </div>
          </div>
        </div>

        {/* Hydration Status */}
        {percentage >= 100 && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-center">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              🎉 Hydration goal reached! Great job!
            </p>
          </div>
        )}

        {percentage < 50 && exerciseCalories > 300 && (
          <div className="mt-4 p-3 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg text-center">
            <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
              💧 Drink more water after your workout!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

