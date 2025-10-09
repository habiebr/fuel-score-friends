import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting comprehensive Google Fit sync for all users...');

    // Get all users with active Google Fit tokens
    const { data: tokens, error: tokensError } = await supabaseClient
      .from('google_tokens')
      .select('user_id, access_token, expires_at')
      .eq('is_active', true);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch Google Fit tokens'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No active Google Fit tokens found',
        users_processed: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`Found ${tokens.length} users with active Google Fit tokens`);

    const results = {
      total_users: tokens.length,
      successful_syncs: 0,
      failed_syncs: 0,
      errors: [] as string[]
    };

    // Process each user by making direct Google Fit API calls
    for (const token of tokens) {
      try {
        console.log(`Syncing Google Fit data for user ${token.user_id}...`);

        // Make direct Google Fit API calls for this user
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        // Fetch sessions
        const sessionsResponse = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`, {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          const sessions = sessionsData.session || [];
          
          console.log(`Found ${sessions.length} sessions for user ${token.user_id}`);
          
          // Filter for exercise activities only (exclude walking)
          const exerciseActivities = [
            'running', 'jogging', 'sprint', 'marathon', 'half_marathon', '5k', '10k',
            'cycling', 'biking', 'road_cycling', 'mountain_biking', 'indoor_cycling',
            'swimming', 'swim', 'pool_swimming', 'open_water_swimming',
            'hiking', 'trail_running', 'mountain_hiking',
            'elliptical', 'elliptical_trainer', 'rowing', 'indoor_rowing', 'outdoor_rowing',
            'soccer', 'football', 'basketball', 'tennis', 'volleyball', 'badminton',
            'golf', 'golfing', 'skiing', 'alpine_skiing', 'cross_country_skiing',
            'snowboarding', 'skating', 'ice_skating', 'roller_skating', 'inline_skating',
            'dancing', 'aerobic_dance', 'zumba', 'salsa', 'hip_hop', 'aerobics',
            'step_aerobics', 'water_aerobics', 'strength_training', 'weight_lifting',
            'weight_training', 'resistance_training', 'crossfit', 'functional_fitness',
            'yoga', 'power_yoga', 'hot_yoga', 'vinyasa_yoga', 'pilates', 'mat_pilates',
            'reformer_pilates', 'martial_arts', 'karate', 'taekwondo', 'judo',
            'boxing', 'kickboxing', 'muay_thai', 'climbing', 'rock_climbing',
            'indoor_climbing', 'bouldering', 'surfing', 'kayaking', 'canoeing',
            'paddleboarding', 'triathlon', 'duathlon', 'athletics', 'track_and_field',
            'gymnastics', 'calisthenics', 'plyometrics', 'mma', 'wrestling',
            'rugby', 'hockey', 'lacrosse', 'baseball', 'softball', 'cricket',
            'squash', 'racquetball', 'handball', 'archery', 'shooting', 'fencing',
            'rowing_machine', 'treadmill', 'stair_climbing', 'stair_master'
          ];

          const excludedActivities = [
            'walking', 'walk', 'strolling', 'leisurely_walk', 'casual_walk',
            'dog_walking', 'power_walking', 'brisk_walking', 'commuting',
            'transportation', 'travel'
          ];

          const exerciseSessions = sessions.filter((session: any) => {
            const activityType = String(session.activityType || '').toLowerCase();
            const sessionName = String(session.name || '').toLowerCase();
            const sessionDescription = String(session.description || '').toLowerCase();
            const applicationName = String(session.application?.packageName || '').toLowerCase();

            // Check if it's explicitly excluded
            const isExcluded = excludedActivities.some(excluded => 
              activityType.includes(excluded) || 
              sessionName.includes(excluded) || 
              sessionDescription.includes(excluded) || 
              applicationName.includes(excluded)
            );

            if (isExcluded) {
              return false;
            }

            // Check if it's an exercise activity
            const isExercise = exerciseActivities.some(activity => 
              activityType.includes(activity) || 
              sessionName.includes(activity) || 
              sessionDescription.includes(activity) || 
              applicationName.includes(activity)
            );

            // Also check Google Fit activity type numbers for running (8, 9, 10)
            const isRunningByType = [8, 9, 10].includes(session.activityType);

            return isExercise || isRunningByType;
          });

          console.log(`Filtered to ${exerciseSessions.length} exercise sessions for user ${token.user_id}`);

          // Store sessions in database
          if (exerciseSessions.length > 0) {
            const sessionInserts = exerciseSessions.map((session: any) => {
              let activityTypeName = 'unknown';
              if (session.name && session.name.trim()) {
                activityTypeName = session.name;
              } else if (session.activityType) {
                const activityTypeMap: Record<number, string> = {
                  8: 'Running',
                  9: 'Jogging', 
                  10: 'Sprinting',
                  1: 'Aerobics',
                  93: 'Swimming',
                  13: 'Weightlifting',
                  112: 'CrossFit',
                  113: 'Functional Training',
                  119: 'Cycling'
                };
                activityTypeName = activityTypeMap[session.activityType] || `Activity ${session.activityType}`;
              }

              return {
                user_id: token.user_id,
                session_id: session.id,
                start_time: new Date(parseInt(session.startTimeMillis)).toISOString(),
                end_time: new Date(parseInt(session.endTimeMillis)).toISOString(),
                activity_type: activityTypeName,
                name: session.name || '',
                description: session.description || '',
                source: 'google_fit',
                raw: session
              };
            });

            const { error: sessionsError } = await supabaseClient
              .from('google_fit_sessions')
              .upsert(sessionInserts, {
                onConflict: 'user_id,session_id',
                ignoreDuplicates: false
              });

            if (sessionsError) {
              console.error(`Error inserting sessions for user ${token.user_id}:`, sessionsError);
              results.failed_syncs++;
              results.errors.push(`User ${token.user_id}: Failed to save sessions`);
              continue;
            }
          }

          results.successful_syncs++;
          console.log(`Successfully synced user ${token.user_id}`);

        } else {
          const errorText = await sessionsResponse.text();
          console.error(`Failed to fetch sessions for user ${token.user_id}:`, errorText);
          results.failed_syncs++;
          results.errors.push(`User ${token.user_id}: ${errorText}`);
        }

        // Add a small delay between users to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing user ${token.user_id}:`, error);
        results.failed_syncs++;
        results.errors.push(`User ${token.user_id}: ${error.message}`);
      }
    }

    console.log('Comprehensive sync completed:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Comprehensive Google Fit sync completed`,
      ...results
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in comprehensive sync function:', error);
    return new Response(JSON.stringify({
      error: error?.message || String(error)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
