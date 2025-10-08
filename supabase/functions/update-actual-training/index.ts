import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

interface GoogleFitSession {
  id: string;
  user_id: string;
  session_id: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  name: string;
  description: string;
  source: string;
  raw: any;
}

interface TrainingActivity {
  id: string;
  user_id: string;
  date: string;
  activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
  start_time?: string;
  duration_minutes: number;
  distance_km?: number;
  intensity: 'low' | 'moderate' | 'high';
  estimated_calories: number;
  notes?: string;
  is_actual?: boolean; // Flag to distinguish actual vs planned
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { date } = await req.json();
    if (!date) {
      return new Response(JSON.stringify({ error: 'Date is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating actual training for user ${user.id} on ${date}`);

    // Get Google Fit sessions for the date
    const { data: googleFitSessions, error: sessionsError } = await supabase
      .from('google_fit_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', `${date}T00:00:00`)
      .lte('start_time', `${date}T23:59:59`)
      .order('start_time', { ascending: true });

    if (sessionsError) {
      console.error('Error fetching Google Fit sessions:', sessionsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch Google Fit sessions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!googleFitSessions || googleFitSessions.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No Google Fit sessions found for this date',
        updated: false
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing planned activities for the date
    const { data: plannedActivities, error: plannedError } = await supabase
      .from('training_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .eq('is_actual', false); // Only planned activities

    if (plannedError) {
      console.error('Error fetching planned activities:', plannedError);
      return new Response(JSON.stringify({ error: 'Failed to fetch planned activities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Remove existing actual activities for this date
    const { error: deleteError } = await supabase
      .from('training_activities')
      .delete()
      .eq('user_id', user.id)
      .eq('date', date)
      .eq('is_actual', true);

    if (deleteError) {
      console.error('Error deleting existing actual activities:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete existing actual activities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert Google Fit sessions to training activities
    const actualActivities: Omit<TrainingActivity, 'id'>[] = googleFitSessions.map(session => {
      const startTime = new Date(session.start_time);
      const endTime = new Date(session.end_time);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      // Map Google Fit activity types to our training activity types
      const activityType = mapGoogleFitActivityType(session.activity_type, session.name);
      
      // Determine intensity based on duration and activity type
      const intensity = determineIntensity(activityType, durationMinutes, session.raw);
      
      // Estimate calories (this could be improved with more sophisticated calculation)
      const estimatedCalories = estimateCalories(activityType, durationMinutes, session.raw);

      return {
        user_id: user.id,
        date: date,
        activity_type: activityType,
        start_time: startTime.toTimeString().split(' ')[0].substring(0, 5), // HH:MM format
        duration_minutes: durationMinutes,
        distance_km: extractDistance(session.raw),
        intensity: intensity,
        estimated_calories: estimatedCalories,
        notes: `Actual: ${session.name}${session.description ? ` - ${session.description}` : ''}`,
        is_actual: true
      };
    });

    // Insert actual activities
    const { data: insertedActivities, error: insertError } = await supabase
      .from('training_activities')
      .insert(actualActivities)
      .select();

    if (insertError) {
      console.error('Error inserting actual activities:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to insert actual activities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if actual activities differ significantly from planned
    const hasSignificantDifference = checkSignificantDifference(plannedActivities || [], actualActivities);

    // Trigger meal plan refresh if there's a significant difference
    if (hasSignificantDifference) {
      try {
        await supabase.functions.invoke('refresh-meal-plan', {
          body: { user_id: user.id, date: date }
        });
        console.log('Meal plan refresh triggered due to significant activity difference');
      } catch (refreshError) {
        console.error('Error triggering meal plan refresh:', refreshError);
        // Don't fail the whole operation if meal plan refresh fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Updated ${actualActivities.length} actual training activities`,
      activities: insertedActivities,
      planned_activities: plannedActivities?.length || 0,
      significant_difference: hasSignificantDifference,
      meal_plan_refreshed: hasSignificantDifference
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-actual-training function:', error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to map Google Fit activity types to our training activity types
function mapGoogleFitActivityType(activityType: string, name: string): 'rest' | 'run' | 'strength' | 'cardio' | 'other' {
  const type = String(activityType || name || '').toLowerCase();
  
  if (type.includes('running') || type.includes('jogging') || type.includes('sprint') || 
      type.includes('marathon') || type.includes('5k') || type.includes('10k')) {
    return 'run';
  }
  
  if (type.includes('strength') || type.includes('weight') || type.includes('lifting') || 
      type.includes('crossfit') || type.includes('gym')) {
    return 'strength';
  }
  
  if (type.includes('cycling') || type.includes('biking') || type.includes('swimming') || 
      type.includes('elliptical') || type.includes('rowing') || type.includes('cardio')) {
    return 'cardio';
  }
  
  return 'other';
}

// Helper function to determine intensity
function determineIntensity(activityType: string, durationMinutes: number, rawData: any): 'low' | 'moderate' | 'high' {
  // Check for heart rate data if available
  if (rawData && rawData.heartRateData) {
    const avgHeartRate = rawData.heartRateData.average;
    if (avgHeartRate > 160) return 'high';
    if (avgHeartRate > 140) return 'moderate';
    return 'low';
  }
  
  // Fallback to duration and activity type
  if (activityType === 'run') {
    if (durationMinutes >= 60) return 'moderate';
    if (durationMinutes >= 30) return 'moderate';
    return 'low';
  }
  
  if (activityType === 'strength') {
    return 'high'; // Strength training is typically high intensity
  }
  
  if (durationMinutes >= 45) return 'moderate';
  return 'low';
}

// Helper function to estimate calories
function estimateCalories(activityType: string, durationMinutes: number, rawData: any): number {
  // Use actual calories from Google Fit if available
  if (rawData && rawData.calories) {
    return Math.round(rawData.calories);
  }
  
  // Fallback estimation based on activity type and duration
  const baseCaloriesPerMinute = {
    'run': 10,
    'strength': 8,
    'cardio': 7,
    'other': 5
  };
  
  const baseRate = baseCaloriesPerMinute[activityType as keyof typeof baseCaloriesPerMinute] || 5;
  return Math.round(baseRate * durationMinutes);
}

// Helper function to extract distance from raw data
function extractDistance(rawData: any): number | null {
  if (rawData && rawData.distance) {
    return Math.round((rawData.distance / 1000) * 100) / 100; // Convert meters to km
  }
  return null;
}

// Helper function to check if actual activities differ significantly from planned
function checkSignificantDifference(planned: TrainingActivity[], actual: Omit<TrainingActivity, 'id'>[]): boolean {
  if (planned.length === 0 && actual.length > 0) return true; // No planned activities but actual ones exist
  if (planned.length > 0 && actual.length === 0) return true; // Planned activities but no actual ones
  
  // Check if total duration differs significantly (>30 minutes)
  const plannedDuration = planned.reduce((sum, act) => sum + act.duration_minutes, 0);
  const actualDuration = actual.reduce((sum, act) => sum + act.duration_minutes, 0);
  
  if (Math.abs(plannedDuration - actualDuration) > 30) return true;
  
  // Check if activity types are different
  const plannedTypes = planned.map(act => act.activity_type).sort();
  const actualTypes = actual.map(act => act.activity_type).sort();
  
  if (JSON.stringify(plannedTypes) !== JSON.stringify(actualTypes)) return true;
  
  return false;
}
