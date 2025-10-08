import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  Zap, 
  Apple, 
  Coffee, 
  Utensils, 
  Activity, 
  CheckCircle, 
  AlertCircle
} from 'lucide-react';
import { format, addDays, isToday, isTomorrow, isYesterday } from 'date-fns';

// Import unified engine types and functions
interface UserProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
}

type TrainingLoad = 'rest' | 'easy' | 'moderate' | 'long' | 'quality';

interface DayTarget {
  date: string;
  load: TrainingLoad;
  kcal: number;
  grams: {
    cho: number;
    protein: number;
    fat: number;
  };
  fueling: {
    pre?: { hoursBefore: number; cho_g: number };
    duringCHOgPerHour?: number | null;
    post?: { minutesAfter: number; cho_g: number; protein_g: number };
  };
}

interface TrainingActivity {
  id?: string;
  date: string;
  activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
  start_time?: string | null;
  duration_minutes: number;
  distance_km?: number | null;
  intensity: 'low' | 'moderate' | 'high';
  estimated_calories: number;
  notes?: string | null;
}

interface NutritionRecommendation {
  type: 'pre' | 'post' | 'during' | 'rest';
  timing: string;
  carbs: number;
  protein: number;
  fat: number;
  calories: number;
  suggestions: string[];
  benefits: string[];
}

interface RecoveryPlan {
  quickRecovery: {
    timing: string;
    carbsG: number;
    proteinG: number;
    fatG: number;
    calories: number;
  };
  fullRecovery: {
    timing: string;
    carbsG: number;
    proteinG: number;
    fatG: number;
    calories: number;
  };
}

interface TrainingNutritionWidgetProps {
  selectedDate: Date;
  activities: TrainingActivity[];
  tomorrowActivities?: TrainingActivity[];
  onRefresh?: () => void;
}

export function TrainingNutritionWidget({ selectedDate, activities, tomorrowActivities = [], onRefresh }: TrainingNutritionWidgetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [recentWorkout, setRecentWorkout] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<NutritionRecommendation[]>([]);
  const [tomorrowRecommendations, setTomorrowRecommendations] = useState<NutritionRecommendation[]>([]);
  const [actualIntake, setActualIntake] = useState<{
    carbs: number;
    protein: number;
    fat: number;
    calories: number;
  }>({ carbs: 0, protein: 0, fat: 0, calories: 0 });
  const [dayTarget, setDayTarget] = useState<DayTarget | null>(null);
  const [actualTrainingData, setActualTrainingData] = useState<any>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const todayActivities = activities.filter(a => a.date === dateStr);
  const hasTraining = todayActivities.length > 0 && todayActivities[0].activity_type !== 'rest';
  const isRestDay = !hasTraining;

  // Function to determine training load from activity
  const determineTrainingLoad = (activity: TrainingActivity): TrainingLoad => {
    if (activity.activity_type === 'rest') return 'rest';
    
    const duration = activity.duration_minutes;
    const intensity = activity.intensity;
    const distance = activity.distance_km || 0;
    
    // For running activities
    if (activity.activity_type === 'run') {
      if (distance >= 20 || duration >= 120) return 'long';
      if (intensity === 'high' || (duration >= 60 && intensity === 'moderate')) return 'quality';
      if (duration >= 60) return 'moderate';
      return 'easy';
    }
    
    // For other activities
    if (intensity === 'high') return 'quality';
    if (duration >= 60) return 'moderate';
    return 'easy';
  };

  // Function to get nutrition recommendations from unified engine
  const getNutritionRecommendations = async (profile: UserProfile, load: TrainingLoad) => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-day-target', {
        body: {
          profile,
          load,
          date: dateStr
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting nutrition recommendations:', error);
      return null;
    }
  };

  // Load user profile
  useEffect(() => {
    if (!user) return;
    
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('weight, height, age, sex')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        const profile: UserProfile = {
          weightKg: data.weight || 70,
          heightCm: data.height || 170,
          age: data.age || 30,
          sex: data.sex || 'male'
        };
        setProfile(profile);
      }
    };

    loadProfile();
  }, [user]);

  // Load actual training data from Google Fit
  useEffect(() => {
    if (!user) return;
    
    const loadActualTrainingData = async () => {
      const { data } = await supabase
        .from('google_fit_sessions')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .order('start_time', { ascending: false });

      if (data && data.length > 0) {
        setActualTrainingData(data[0]);
        setRecentWorkout(data[0]);
      }
    };

    loadActualTrainingData();
  }, [user, dateStr]);

  // Load actual food intake for the day
  useEffect(() => {
    if (!user) return;
    
    const loadActualIntake = async () => {
      const { data: foodLogs } = await supabase
        .from('food_logs')
        .select('carbs_grams, protein_grams, fat_grams, calories')
        .eq('user_id', user.id)
        .gte('logged_at', `${dateStr}T00:00:00`)
        .lte('logged_at', `${dateStr}T23:59:59`);

      if (foodLogs) {
        const total = foodLogs.reduce((acc, log) => ({
          carbs: acc.carbs + (log.carbs_grams || 0),
          protein: acc.protein + (log.protein_grams || 0),
          fat: acc.fat + (log.fat_grams || 0),
          calories: acc.calories + (log.calories || 0),
        }), { carbs: 0, protein: 0, fat: 0, calories: 0 });
        
        setActualIntake(total);
      }
    };

    loadActualIntake();
  }, [user, dateStr]);

  // Generate nutrition recommendations using unified engine
  useEffect(() => {
    if (!profile || !todayActivities.length) return;

    const generateRecommendations = async () => {
      const recs: NutritionRecommendation[] = [];
      
      // Determine training load - use actual data if available, otherwise use planned
      let trainingLoad: TrainingLoad;
      let activity = todayActivities[0];
      
      if (actualTrainingData) {
        // Use actual training data
        const actualActivity: TrainingActivity = {
          id: actualTrainingData.id,
          date: dateStr,
          activity_type: actualTrainingData.activity_type || 'run',
          start_time: actualTrainingData.start_time ? format(new Date(actualTrainingData.start_time), 'HH:mm') : null,
          duration_minutes: actualTrainingData.duration_minutes || 30,
          distance_km: actualTrainingData.distance_km || null,
          intensity: actualTrainingData.intensity || 'moderate',
          estimated_calories: actualTrainingData.calories_burned || 300,
          notes: actualTrainingData.description || null
        };
        activity = actualActivity;
        trainingLoad = determineTrainingLoad(actualActivity);
      } else {
        // Use planned training data
        trainingLoad = determineTrainingLoad(activity);
      }

      // Get nutrition recommendations from unified engine
      const dayTargetData = await getNutritionRecommendations(profile, trainingLoad);
      
      if (dayTargetData) {
        setDayTarget(dayTargetData);
        
        if (trainingLoad === 'rest') {
          recs.push({
            type: 'rest',
            timing: 'All day',
            carbs: 0,
            protein: 0,
            fat: 0,
            calories: 0,
            suggestions: [
              'Focus on whole foods',
              'Stay hydrated',
              'Get adequate sleep',
              'Light stretching or yoga'
            ],
            benefits: [
              'Muscle recovery',
              'Energy restoration',
              'Mental relaxation'
            ]
          });
        } else {
          // Pre-workout recommendations
          if (dayTargetData.fueling.pre) {
            recs.push({
              type: 'pre',
              timing: `${dayTargetData.fueling.pre.hoursBefore} hours before${activity.start_time ? ` (${activity.start_time})` : ''}`,
              carbs: dayTargetData.fueling.pre.cho_g,
              protein: Math.round(profile.weightKg * 0.3),
              fat: Math.round(profile.weightKg * 0.2),
              calories: Math.round((dayTargetData.fueling.pre.cho_g * 4) + (profile.weightKg * 0.3 * 4) + (profile.weightKg * 0.2 * 9)),
              suggestions: [
                'Banana with peanut butter',
                'Oatmeal with berries',
                'Toast with honey',
                'Greek yogurt with granola'
              ],
              benefits: [
                'Sustained energy',
                'Prevents hunger',
                'Optimizes performance'
              ]
            });
          }

          // During workout (for long sessions)
          if (dayTargetData.fueling.duringCHOgPerHour) {
            recs.push({
              type: 'during',
              timing: 'Every 45-60 minutes',
              carbs: dayTargetData.fueling.duringCHOgPerHour,
              protein: 0,
              fat: 0,
              calories: dayTargetData.fueling.duringCHOgPerHour * 4,
              suggestions: [
                'Sports drink',
                'Energy gels',
                'Banana',
                'Dates'
              ],
              benefits: [
                'Maintains energy',
                'Prevents bonking',
                'Sustains performance'
              ]
            });
          }

          // Post-workout recommendations
          if (dayTargetData.fueling.post) {
            recs.push({
              type: 'post',
              timing: `Within ${dayTargetData.fueling.post.minutesAfter} minutes`,
              carbs: dayTargetData.fueling.post.cho_g,
              protein: dayTargetData.fueling.post.protein_g,
              fat: Math.round(profile.weightKg * 0.1),
              calories: Math.round((dayTargetData.fueling.post.cho_g * 4) + (dayTargetData.fueling.post.protein_g * 4) + (profile.weightKg * 0.1 * 9)),
              suggestions: [
                'Chocolate milk',
                'Protein smoothie',
                'Rice with chicken',
                'Greek yogurt with fruit'
              ],
              benefits: [
                'Muscle recovery',
                'Glycogen replenishment',
                'Reduces soreness'
              ]
            });
          }
        }
      }

      return recs;
    };

           generateRecommendations().then(setRecommendations);
         }, [profile, todayActivities, actualTrainingData, dateStr]);

         // Generate tomorrow's pre-training recommendations
         useEffect(() => {
           if (!profile || !tomorrowActivities.length) {
             setTomorrowRecommendations([]);
             return;
           }

           const generateTomorrowRecommendations = async () => {
             const recs: NutritionRecommendation[] = [];

             // Check if tomorrow has training
             const tomorrowHasTraining = tomorrowActivities.length > 0 && tomorrowActivities[0].activity_type !== 'rest';
             
             if (!tomorrowHasTraining) {
               return recs; // No recommendations for rest day
             }

             // Determine training load for tomorrow
             const tomorrowActivity = tomorrowActivities[0];
             const trainingLoad = determineTrainingLoad(tomorrowActivity);

             // Get nutrition recommendations for tomorrow
             const tomorrowDateStr = format(addDays(selectedDate, 1), 'yyyy-MM-dd');
             const dayTargetData = await getNutritionRecommendations(profile, trainingLoad);

             if (dayTargetData && dayTargetData.fueling.pre) {
               recs.push({
                 type: 'pre',
                 timing: `${dayTargetData.fueling.pre.hoursBefore} hours before tomorrow's training`,
                 carbs: dayTargetData.fueling.pre.cho_g,
                 protein: Math.round(profile.weightKg * 0.3),
                 fat: Math.round(profile.weightKg * 0.2),
                 calories: Math.round((dayTargetData.fueling.pre.cho_g * 4) + (profile.weightKg * 0.3 * 4) + (profile.weightKg * 0.2 * 9)),
                 suggestions: [
                   'Banana with peanut butter',
                   'Oatmeal with berries',
                   'Toast with honey',
                   'Greek yogurt with granola'
                 ],
                 benefits: [
                   'Sustained energy',
                   'Prevents hunger',
                   'Optimizes performance'
                 ]
               });
             }

             return recs;
           };

           generateTomorrowRecommendations().then(setTomorrowRecommendations);
         }, [profile, tomorrowActivities, selectedDate]);

  const getTimingIcon = (type: string) => {
    switch (type) {
      case 'pre': return <Coffee className="h-4 w-4" />;
      case 'during': return <Zap className="h-4 w-4" />;
      case 'post': return <Apple className="h-4 w-4" />;
      case 'rest': return <Utensils className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getTimingColor = (type: string) => {
    switch (type) {
      case 'pre': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'during': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'post': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'rest': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };


  if (isRestDay) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-gray-500" />
            Rest Day Nutrition
          </CardTitle>
          <CardDescription>
            {isToday(selectedDate) ? 'Today is a rest day' : 
             isTomorrow(selectedDate) ? 'Tomorrow is a rest day' :
             isYesterday(selectedDate) ? 'Yesterday was a rest day' :
             `${format(selectedDate, 'MMM dd')} is a rest day`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Utensils className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Take It Easy</h3>
            <p className="text-muted-foreground mb-4">
              Focus on recovery, hydration, and maintaining a balanced diet.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Stay hydrated throughout the day</p>
              <p>• Eat whole, nutritious foods</p>
              <p>• Get adequate sleep</p>
              <p>• Light stretching or yoga</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4">
        {/* Training Summary */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">
              {actualTrainingData ? 'Actual Training' : 'Planned Training'}
            </span>
            {actualTrainingData && (
              <Badge variant="secondary" className="text-xs">Live Data</Badge>
            )}
          </div>
          {todayActivities.map((activity, index) => (
            <div key={index} className="text-sm">
              <p className="font-medium capitalize">{activity.activity_type}</p>
              <p className="text-muted-foreground">
                {activity.duration_minutes} min • {activity.intensity} intensity
                {activity.distance_km && ` • ${activity.distance_km}km`}
                {actualTrainingData && (
                  <span className="text-green-600 ml-2">✓ Completed</span>
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Nutrition Recommendations */}
        {recommendations.map((rec, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              {getTimingIcon(rec.type)}
              <Badge className={getTimingColor(rec.type)}>
                {rec.type.toUpperCase()}
              </Badge>
              <span className="text-sm font-medium">{rec.timing}</span>
            </div>


            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Suggestions:</p>
                <div className="flex flex-wrap gap-1">
                  {rec.suggestions.map((suggestion, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Benefits:</p>
                <div className="flex flex-wrap gap-1">
                  {rec.benefits.map((benefit, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {benefit}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

               {/* Tomorrow's Pre-Training Recommendations */}
               {tomorrowRecommendations.length > 0 && (
                 <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                   <div className="flex items-center gap-2 mb-3">
                     <Coffee className="h-5 w-5 text-blue-600" />
                     <span className="font-medium text-blue-800 dark:text-blue-200">Tomorrow's Pre-Training Fuel</span>
                   </div>
                   <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                     Prepare for tomorrow's training with these nutrition suggestions
                   </p>
                   
                   {tomorrowRecommendations.map((rec, index) => (
                     <div key={`tomorrow-${index}`} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
                       <div className="flex items-center gap-2 mb-3">
                         {getTimingIcon(rec.type)}
                         <Badge className={getTimingColor(rec.type)}>
                           {rec.type.toUpperCase()}
                         </Badge>
                         <span className="text-sm font-medium">{rec.timing}</span>
                       </div>

                       <div className="space-y-2">
                         <div>
                           <p className="text-sm font-medium text-foreground mb-1">Suggestions:</p>
                           <div className="flex flex-wrap gap-1">
                             {rec.suggestions.map((suggestion, i) => (
                               <Badge key={i} variant="secondary" className="text-xs">
                                 {suggestion}
                               </Badge>
                             ))}
                           </div>
                         </div>
                         <div>
                           <p className="text-sm font-medium text-foreground mb-1">Benefits:</p>
                           <div className="flex flex-wrap gap-1">
                             {rec.benefits.map((benefit, i) => (
                               <Badge key={i} variant="outline" className="text-xs">
                                 {benefit}
                               </Badge>
                             ))}
                           </div>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}

               {/* Recent Workout Recovery */}
               {recentWorkout && (
                 <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                   <div className="flex items-center gap-2 mb-2">
                     <CheckCircle className="h-4 w-4 text-green-600" />
                     <span className="font-medium text-green-800 dark:text-green-200">Recent Workout Detected</span>
                   </div>
                   <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                     {recentWorkout.activity_type} • {format(new Date(recentWorkout.start_time), 'MMM dd, HH:mm')}
                   </p>
                   <p className="text-xs text-green-600 dark:text-green-400">
                     Focus on post-workout recovery nutrition above
                   </p>
                 </div>
               )}
      </CardContent>
    </Card>
  );
}
