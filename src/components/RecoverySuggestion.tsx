import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Utensils, Clock, Info, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface RecoveryMeal {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timing: string;
  benefits: string[];
}

interface RecoverySuggestionProps {
  sessionEnd: Date;
  intensity: string;
  duration: number;
  distance?: number;
  calories_burned: number;
  onDismiss: () => void;
}

export function RecoverySuggestion({ 
  sessionEnd,
  intensity,
  duration,
  distance,
  calories_burned,
  onDismiss
}: RecoverySuggestionProps) {
  const [showNotification, setShowNotification] = useState(true);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  // Show PWA notification
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Time for Recovery Nutrition!', {
        body: 'Get your post-run nutrition within the next 30 minutes for optimal recovery.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'recovery-nutrition',
        requireInteraction: true
      });

      notification.onclick = () => {
        window.focus();
      };
    }
  }, []);

  // Get recovery meals from unified engine and AI
  const getRecoveryMeals = async () => {
    if (!user) return null;

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const apiKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

      // Get user profile for weight-based calculations
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('weight_kg, height_cm, age, sex, dietary_restrictions, eating_behaviors')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) return null;

      // Calculate recovery needs using unified engine
      const { data: recoveryPlan } = await supabase.functions.invoke('generate-recovery-plan', {
        body: {
          profile: {
            weightKg: profile.weight_kg,
            heightCm: profile.height_cm,
            age: profile.age,
            sex: profile.sex,
            restrictions: profile.dietary_restrictions || [],
            behaviors: profile.eating_behaviors || []
          },
          workout: {
            intensity,
            duration,
            distance,
            calories_burned
          }
        },
        headers: {
          ...(apiKey ? { apikey: apiKey } : {}),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        }
      });

      if (!recoveryPlan) throw new Error('Failed to generate recovery plan');

      return {
        quick: {
          name: recoveryPlan.quick.name,
          description: recoveryPlan.quick.description,
          calories: recoveryPlan.quick.calories,
          protein: recoveryPlan.quick.protein,
          carbs: recoveryPlan.quick.carbs,
          fat: recoveryPlan.quick.fat,
          timing: 'Within 30 minutes',
          benefits: recoveryPlan.quick.benefits
        },
        full: {
          name: recoveryPlan.full.name,
          description: recoveryPlan.full.description,
          calories: recoveryPlan.full.calories,
          protein: recoveryPlan.full.protein,
          carbs: recoveryPlan.full.carbs,
          fat: recoveryPlan.full.fat,
          timing: 'Within 2 hours',
          benefits: recoveryPlan.full.benefits
        }
      };
    } catch (error) {
      console.error('Error generating recovery meals:', error);
      // Fallback to engine-calculated suggestions without AI
      const isHighIntensity = intensity === 'high' || duration > 60 || (distance && distance > 10);
      const carbsNeeded = isHighIntensity ? 1.2 : 1.0; // g/kg/hour
      const proteinNeeded = isHighIntensity ? 0.3 : 0.25; // g/kg/hour
      
      return {
        quick: {
          name: 'Susu Pisang + Roti Selai Kacang',
          description: 'Kombinasi cepat dengan rasio karbohidrat-protein optimal',
          calories: 280,
          protein: 12,
          carbs: 45,
          fat: 8,
          timing: 'Within 30 minutes',
          benefits: [
            'Rasio karbohidrat-protein 4:1 untuk pemulihan glikogen',
            'Protein cepat serap untuk pemulihan otot',
            'Elektrolit dari susu membantu rehidrasi',
            'Kalium dari pisang mencegah kram'
          ]
        },
        full: {
          name: 'Bubur Ayam Komplit',
          description: 'Makanan pemulihan lengkap dengan karbohidrat kompleks dan protein',
          calories: 550,
          protein: 35,
          carbs: 75,
          fat: 15,
          timing: 'Within 2 hours',
          benefits: [
            'Karbohidrat kompleks memulihkan simpanan glikogen',
            'Profil protein lengkap untuk perbaikan otot',
            'Kaya zat besi untuk transportasi oksigen',
            'Elektrolit seimbang untuk rehidrasi'
          ]
        }
      };
    }
  };

  const { user } = useAuth();
  const [recoveryMeals, setRecoveryMeals] = useState<{ quick: RecoveryMeal; full: RecoveryMeal } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRecoveryMeals = async () => {
      const meals = await getRecoveryMeals();
      setRecoveryMeals(meals);
      setLoading(false);
    };
    loadRecoveryMeals();
  }, []);
  const minutesSinceEnd = Math.round((new Date().getTime() - sessionEnd.getTime()) / 60000);
  const isWithinWindow = minutesSinceEnd <= 30;

  if (!showNotification) return null;

  return (
    <Card className="shadow-card mb-4 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Recovery Nutrition Window
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-orange-700 dark:text-orange-300"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Timing Info */}
          <div className="flex items-center gap-2 text-sm text-orange-800 dark:text-orange-200">
            <Clock className="h-4 w-4" />
            <span>
              {isWithinWindow
                ? `${30 - minutesSinceEnd} minutes remaining in optimal window`
                : 'Recovery window closing soon'}
            </span>
          </div>

          {/* Quick Recovery Option */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium">{recoveryMeals.quick.name}</h4>
                <p className="text-xs text-muted-foreground">{recoveryMeals.quick.timing}</p>
              </div>
              <Badge variant="secondary">{recoveryMeals.quick.calories} cal</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded p-1">
                <div className="text-sm font-medium">{recoveryMeals.quick.protein}g</div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div className="text-center bg-green-50 dark:bg-green-900/20 rounded p-1">
                <div className="text-sm font-medium">{recoveryMeals.quick.carbs}g</div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 rounded p-1">
                <div className="text-sm font-medium">{recoveryMeals.quick.fat}g</div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>
            <Button 
              variant="default" 
              size="sm" 
              className="w-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
              onClick={() => {
                // TODO: Log quick recovery meal
                onDismiss();
              }}
            >
              Log Quick Recovery
            </Button>
          </div>

          {/* Full Recovery Meal */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-medium">{recoveryMeals.full.name}</h4>
                <p className="text-xs text-muted-foreground">{recoveryMeals.full.timing}</p>
              </div>
              <Badge variant="secondary">{recoveryMeals.full.calories} cal</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center bg-blue-50 dark:bg-blue-900/20 rounded p-1">
                <div className="text-sm font-medium">{recoveryMeals.full.protein}g</div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div className="text-center bg-green-50 dark:bg-green-900/20 rounded p-1">
                <div className="text-sm font-medium">{recoveryMeals.full.carbs}g</div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 rounded p-1">
                <div className="text-sm font-medium">{recoveryMeals.full.fat}g</div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => {
                // TODO: Log full recovery meal
                onDismiss();
              }}
            >
              Log Full Recovery Meal
            </Button>
          </div>

          {/* Recovery Tips */}
          <div className="text-xs text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Why Recovery Nutrition Matters</p>
                <ul className="space-y-1 list-disc list-inside">
                  {recoveryMeals.quick.benefits.map((benefit, idx) => (
                    <li key={idx}>{benefit}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
