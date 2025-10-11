// @deno-types="https://deno.land/x/types/deno.ns.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

interface TrainingActivity {
  id?: string;
  user_id: string;
  date: string;
  activity_type: 'rest' | 'run' | 'strength' | 'cardio' | 'other';
  start_time: string | null;
  duration_minutes: number;
  distance_km: number | null;
  intensity: 'low' | 'moderate' | 'high';
  estimated_calories: number;
  notes: string | null;
  is_actual?: boolean;
}

interface GoogleFitSession {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  activity_type: string;
  name: string;
  description?: string;
  raw: any;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { userId, date } = await req.json();
    if (!userId || !date) {
      return new Response(JSON.stringify({ error: 'userId and date are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = { id: userId }; // Use the provided user ID

    if (!date) {
      return new Response(JSON.stringify({ error: 'Date is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Updating actual training for user ${user.id} on ${date}`);

    // Check if user has a Google Fit token
    console.log('Checking Google Fit token for user:', user.id);
    const { data: googleFitToken, error: tokenError } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors

    console.log('Active Google Fit token:', { googleFitToken, tokenError });

    if (tokenError || !googleFitToken) {
      console.log(`User ${user.id} does not have a Google Fit token connected`);
      return new Response(JSON.stringify({ 
        message: 'Google Fit not connected',
        error: 'No valid Google Fit token found - please connect your Google Fit account in settings',
        updated: false,
        requires_google_fit_connection: true
      }), {
        status: 200, // Return 200 instead of error since this is expected for some users
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(googleFitToken.expires_at);
    if (expiresAt <= now) {
      console.log(`User ${user.id} has expired Google Fit token`);
      return new Response(JSON.stringify({ 
        message: 'Google Fit token expired',
        error: 'Google Fit token has expired - background token renewal should handle this',
        updated: false,
        token_expired: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Google Fit sessions for the date
    const { data: googleFitSessions, error: sessionsError } = await supabase
      .from('google_fit_sessions')
      .select('*')
      .eq('user_id', user.id);
    
    console.log('DEBUG: Google Fit sessions:', JSON.stringify(googleFitSessions, null, 2));
    console.log('DEBUG: Sessions error if any:', sessionsError);

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
        updated: false,
        has_token: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get existing activities for the date (both planned and actual)
    const { data: existingActivities, error: activitiesError } = await supabase
      .from('training_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date);

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const plannedActivities = existingActivities?.filter(a => !a.is_actual) || [];
    const existingActualActivities = existingActivities?.filter(a => a.is_actual) || [];

    // Convert Google Fit sessions to training activity updates
    const googleFitActivities: Omit<TrainingActivity, 'id'>[] = googleFitSessions.map((session: GoogleFitSession) => {
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

    let updatedActivities;
    
    // Delete any existing actual activities for this date to prevent duplicates
    if (existingActualActivities && existingActualActivities.length > 0) {
      await supabase
        .from('training_activities')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('is_actual', true);
    }
    
    // If there's a planned activity, update it with actual data (use first Google Fit session only)
    if (plannedActivities && plannedActivities.length > 0) {
      const plannedActivity = plannedActivities[0]; // Take the first planned activity
      const googleFitData = googleFitActivities[0]; // Take the first Google Fit session only
      
      if (googleFitData) {
        // Update the planned activity with actual data
        const { data: updated, error: updateError } = await supabase
          .from('training_activities')
          .update({
            activity_type: googleFitData.activity_type,
            start_time: googleFitData.start_time,
            duration_minutes: googleFitData.duration_minutes,
            distance_km: googleFitData.distance_km,
            intensity: googleFitData.intensity,
            estimated_calories: googleFitData.estimated_calories,
            notes: googleFitData.notes,
            is_actual: true
          })
          .eq('id', plannedActivity.id)
          .select();

        if (updateError) {
          console.error('Error updating planned activity:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update planned activity' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        updatedActivities = updated;
      }
    } else {
      // No planned activity exists, insert only the first actual activity
      const firstActivity = googleFitActivities[0];
      if (firstActivity) {
        const { data: inserted, error: insertError } = await supabase
          .from('training_activities')
          .insert([firstActivity]) // Insert only the first activity
          .select();

        if (insertError) {
          console.error('Error inserting actual activity:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to insert actual activity' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        updatedActivities = inserted;
      }
    }

    // Check if actual activities differ significantly from planned
    const hasSignificantDifference = checkSignificantDifference(plannedActivities || [], googleFitActivities);

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
      message: `Updated ${googleFitActivities.length} actual training activities`,
      activities: updatedActivities,
      planned_activities: plannedActivities?.length || 0,
      significant_difference: hasSignificantDifference,
      meal_plan_refreshed: hasSignificantDifference,
      updated_existing: plannedActivities && plannedActivities.length > 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-actual-training function:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
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
