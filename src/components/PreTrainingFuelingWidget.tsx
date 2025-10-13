import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { addDays, format } from 'date-fns';
import { getLocalDateString } from '@/lib/timezone';
import { Flame, Clock, TrendingUp, Apple } from 'lucide-react';

interface TrainingActivity {
  id: string;
  date: string;
  activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
  duration_minutes: number;
  distance_km?: number | null;
  intensity: 'low' | 'moderate' | 'high';
  estimated_calories: number;
  start_time?: string | null;
}

interface FuelingAdvice {
  show: boolean;
  trainingType: string;
  trainingDistance?: number;
  trainingDuration: number;
  trainingTime?: string;
  preFuelingCHO_g: number;
  windowStart: string; // e.g., "6:00 AM"
  windowEnd: string;   // e.g., "7:00 AM"
  foods: string[];
  reasoning: string;
}

export function PreTrainingFuelingWidget() {
  const { user } = useAuth();
  const [advice, setAdvice] = useState<FuelingAdvice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadTomorrowTraining();
  }, [user]);

  const loadTomorrowTraining = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get tomorrow's date
      const tomorrow = addDays(new Date(), 1);
      const tomorrowStr = getLocalDateString(tomorrow);
      
      // Get user profile for weight
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('weight_kg, sex')
        .eq('user_id', user.id)
        .single();
      
      if (!profile || !profile.weight_kg) {
        setAdvice(null);
        setLoading(false);
        return;
      }
      
      // Get tomorrow's planned training
      const { data: activities } = await (supabase as any)
        .from('training_activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', tomorrowStr);
      
      if (!activities || activities.length === 0) {
        setAdvice(null);
        setLoading(false);
        return;
      }
      
      // Analyze if pre-fueling is needed
      const totalDuration = activities.reduce((sum: number, act: TrainingActivity) => 
        sum + (act.duration_minutes || 0), 0);
      const totalDistance = activities.reduce((sum: number, act: TrainingActivity) => 
        sum + (act.distance_km || 0), 0);
      const hasRun = activities.some((act: TrainingActivity) => act.activity_type === 'run');
      const hasHighIntensity = activities.some((act: TrainingActivity) => act.intensity === 'high');
      const firstActivity = activities[0] as TrainingActivity;
      
      // Determine if pre-fueling needed (long runs, quality workouts, or sessions > 60 min)
      const needsPreFueling = (
        totalDistance >= 10 || // Long run
        hasHighIntensity || // Quality workout
        totalDuration >= 60 // Extended session
      );
      
      if (!needsPreFueling) {
        setAdvice(null);
        setLoading(false);
        return;
      }
      
      // Calculate pre-fueling CHO (Science Layer: 1.5g CHO/kg body weight)
      const preFuelingCHO_g = Math.round(profile.weight_kg * 1.5);
      
      // Determine fueling window (1-2 hours before training)
      const trainingTime = firstActivity.start_time;
      let windowStart = '';
      let windowEnd = '';
      
      if (trainingTime) {
        const [hours, minutes] = trainingTime.split(':').map(Number);
        const trainingDate = new Date();
        trainingDate.setHours(hours, minutes, 0);
        
        // 2 hours before
        const twoHoursBefore = new Date(trainingDate.getTime() - 2 * 60 * 60 * 1000);
        windowStart = format(twoHoursBefore, 'h:mm a');
        
        // 1 hour before
        const oneHourBefore = new Date(trainingDate.getTime() - 1 * 60 * 60 * 1000);
        windowEnd = format(oneHourBefore, 'h:mm a');
      } else {
        windowStart = '1-2 hours before';
        windowEnd = 'your training';
      }
      
      // Suggest appropriate foods
      const foods = getFoodSuggestions(preFuelingCHO_g);
      
      // Create reasoning
      let reasoning = '';
      if (totalDistance >= 15) {
        reasoning = 'Long run ahead! Pre-fuel to maximize glycogen stores and prevent hitting the wall.';
      } else if (hasHighIntensity) {
        reasoning = 'Quality workout tomorrow! Fuel up to maintain high intensity throughout the session.';
      } else {
        reasoning = 'Extended training session tomorrow. Pre-fueling ensures sustained energy.';
      }
      
      setAdvice({
        show: true,
        trainingType: hasRun ? 'Run' : firstActivity.activity_type,
        trainingDistance: totalDistance > 0 ? totalDistance : undefined,
        trainingDuration: totalDuration,
        trainingTime: trainingTime || undefined,
        preFuelingCHO_g,
        windowStart,
        windowEnd,
        foods,
        reasoning
      });
      
    } catch (error) {
      console.error('Error loading tomorrow training:', error);
      setAdvice(null);
    } finally {
      setLoading(false);
    }
  };
  
  const getFoodSuggestions = (cho_g: number): string[] => {
    // Indonesian-friendly pre-workout foods
    const suggestions = [];
    
    if (cho_g >= 100) {
      suggestions.push(`Nasi putih (150g) + Pisang (2 buah) + Madu (1 sdm)`);
      suggestions.push(`Roti tawar (4 lembar) + Selai kacang + Pisang`);
      suggestions.push(`Bubur ayam (1 mangkok besar) + Pisang`);
    } else if (cho_g >= 70) {
      suggestions.push(`Nasi putih (100g) + Pisang (1 buah)`);
      suggestions.push(`Roti tawar (3 lembar) + Selai + Pisang`);
      suggestions.push(`Oatmeal (80g) + Madu + Pisang`);
    } else {
      suggestions.push(`Pisang (2 buah) + Roti tawar (2 lembar)`);
      suggestions.push(`Nasi putih (80g) + Telur`);
      suggestions.push(`Energy bar + Pisang`);
    }
    
    return suggestions;
  };

  if (loading || !advice || !advice.show) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-orange-100 p-2">
              <Flame className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Pre-Training Fueling Reminder</CardTitle>
              <CardDescription>Tomorrow's training requires carb-loading</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            Tomorrow
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Training Info */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="h-4 w-4 text-orange-600" />
            <span className="font-medium">{advice.trainingType}</span>
            {advice.trainingDistance && (
              <span className="text-muted-foreground">• {advice.trainingDistance}km</span>
            )}
            {advice.trainingDuration && (
              <span className="text-muted-foreground">• {advice.trainingDuration} min</span>
            )}
          </div>
          
          {advice.trainingTime && (
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-muted-foreground">Starts at {advice.trainingTime}</span>
            </div>
          )}
        </div>
        
        {/* Reasoning */}
        <Alert className="border-orange-200 bg-white">
          <AlertDescription className="text-sm">{advice.reasoning}</AlertDescription>
        </Alert>
        
        {/* Carb Target */}
        <div className="rounded-lg bg-white border border-orange-200 p-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-orange-600">{advice.preFuelingCHO_g}g</span>
            <span className="text-sm text-muted-foreground">carbohydrates</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Science-based: 1.5g CHO per kg body weight
          </p>
        </div>
        
        {/* Timing Window */}
        <div className="rounded-lg bg-white border border-orange-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium">Optimal Fueling Window</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {advice.windowStart} - {advice.windowEnd}
          </p>
        </div>
        
        {/* Food Suggestions */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Apple className="h-4 w-4 text-orange-600" />
            <span className="text-sm font-medium">Suggested Meals</span>
          </div>
          <ul className="space-y-1.5">
            {advice.foods.map((food, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-orange-400">•</span>
                <span>{food}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Footer Tip */}
        <div className="pt-2 border-t border-orange-100">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Pro tip:</strong> Choose easily digestible foods and avoid high fiber/fat to prevent GI distress.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
