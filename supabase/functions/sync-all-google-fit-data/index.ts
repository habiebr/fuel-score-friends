import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

interface GoogleFitSession {
  id: string;
  name: string;
  description: string;
  startTimeMillis: string;
  endTimeMillis: string;
  activityType: number;
  application: {
    packageName: string;
    version: string;
    detailsUrl: string;
  };
  activeTimeMillis: string;
  modifiedTimeMillis: string;
}

interface GoogleFitDataSource {
  dataType: {
    name: string;
    field: Array<{
      name: string;
      format: string;
    }>;
  };
  application: {
    packageName: string;
    version: string;
    detailsUrl: string;
  };
  device: {
    manufacturer: string;
    model: string;
    type: string;
    uid: string;
    version: string;
  };
  dataStreamId: string;
  dataStreamName: string;
}

interface GoogleFitDataPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  dataTypeName: string;
  originDataSourceId: string;
  value: Array<{
    intVal?: number;
    fpVal?: number;
    stringVal?: string;
    mapVal?: Array<{
      key: string;
      value: {
        fpVal: number;
      };
    }>;
  }>;
}

interface GoogleFitDataset {
  dataSourceId: string;
  maxEndTimeNanos: string;
  minStartTimeNanos: string;
  point: GoogleFitDataPoint[];
}

interface GoogleFitBucket {
  startTimeMillis: string;
  endTimeMillis: string;
  dataset: GoogleFitDataset[];
}

interface GoogleFitAggregateResponse {
  bucket: GoogleFitBucket[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token directly
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - invalid token',
        debug: { userError: userError?.message }
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resolvedUserId = user.id;
    const parsedBody = await req.clone().json().catch(() => ({} as any));
    const { accessToken, days = 30, userId } = parsedBody;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Access token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Syncing Google Fit data for user ${resolvedUserId} for last ${days} days`);

    // Function to refresh Google Fit token using the main refresh function
    const refreshGoogleFitToken = async () => {
      try {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-all-google-tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            batch_size: 1,
            threshold_minutes: 1
          })
        });

        if (!response.ok) {
          throw new Error('Failed to refresh token');
        }

        const result = await response.json();
        if (result.successful_refreshes > 0) {
          // Get the refreshed token
          const { data: tokenData, error: tokenError } = await supabaseClient
            .from('google_tokens')
            .select('access_token')
            .eq('user_id', resolvedUserId)
            .eq('is_active', true)
            .single();

          if (tokenError || !tokenData?.access_token) {
            throw new Error('Failed to get refreshed token');
          }

          return tokenData.access_token;
        } else {
          throw new Error('Token refresh returned no success');
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
      }
    };

    // Function to make Google Fit API call with automatic token refresh
    const makeGoogleFitRequest = async (url: string, options: RequestInit = {}) => {
      let currentToken = accessToken;
      
      const makeRequest = async (token: string) => {
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      };

      let response = await makeRequest(currentToken);
      
      // If 401, try to refresh token and retry
      if (response.status === 401) {
        console.log('Token expired, refreshing...');
        try {
          currentToken = await refreshGoogleFitToken();
          console.log('Token refreshed successfully');
          response = await makeRequest(currentToken);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          throw refreshError;
        }
      }
      
      return response;
    };

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startTimeMillis = startDate.getTime();
    const endTimeMillis = endDate.getTime();

    // Fetch all sessions for the date range
    const sessionsResponse = await makeGoogleFitRequest(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`
    );

    if (!sessionsResponse.ok) {
      const errorText = await sessionsResponse.text();
      console.error('Google Fit sessions API error:', sessionsResponse.status, errorText);
      console.error('Request URL:', `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`);
      return new Response(JSON.stringify({ 
        error: `Google Fit API error: ${sessionsResponse.status}`,
        details: errorText,
        url: `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`
      }), {
        status: sessionsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionsData = await sessionsResponse.json();
    const sessions: GoogleFitSession[] = sessionsData.session || [];

    console.log(`Raw sessions data:`, JSON.stringify(sessions, null, 2));

    console.log(`Found ${sessions.length} total sessions`);

    // Also fetch data sources to understand what data is available
    try {
      const dataSourcesResponse = await makeGoogleFitRequest(
        'https://www.googleapis.com/fitness/v1/users/me/dataSources'
      );
      
      if (dataSourcesResponse.ok) {
        const dataSourcesData = await dataSourcesResponse.json();
        console.log(`Available data sources:`, dataSourcesData.dataSource?.length || 0);
        
        // Log some data source details for debugging
        if (dataSourcesData.dataSource) {
          dataSourcesData.dataSource.slice(0, 5).forEach((ds: any) => {
            console.log(`Data source: ${ds.dataType?.name} - ${ds.device?.manufacturer} ${ds.device?.model}`);
          });
        }
      }
    } catch (error) {
      console.log('Could not fetch data sources:', error);
    }

    // Filter for exercise activities only (exclude walking)
    const exerciseActivities = [
      'running', 'jogging', 'sprint', 'marathon', 'half_marathon', '5k', '10k',
      'cycling', 'biking', 'bike', 'road_cycling', 'mountain_biking', 'indoor_cycling',
      'swimming', 'swim', 'pool_swimming', 'open_water_swimming',
      'hiking', 'trail_running', 'mountain_hiking',
      'elliptical', 'elliptical_trainer',
      'rowing', 'indoor_rowing', 'outdoor_rowing',
      'soccer', 'football', 'basketball', 'tennis', 'volleyball', 'badminton',
      'golf', 'golfing',
      'skiing', 'alpine_skiing', 'cross_country_skiing', 'snowboarding',
      'skating', 'ice_skating', 'roller_skating', 'inline_skating',
      'dancing', 'aerobic_dance', 'zumba', 'salsa', 'hip_hop',
      'aerobics', 'step_aerobics', 'water_aerobics',
      'strength_training', 'weight_lifting', 'weight_training', 'resistance_training',
      'crossfit', 'functional_fitness',
      'yoga', 'power_yoga', 'hot_yoga', 'vinyasa_yoga',
      'pilates', 'mat_pilates', 'reformer_pilates',
      'martial_arts', 'karate', 'taekwondo', 'judo', 'boxing', 'kickboxing', 'muay_thai',
      'climbing', 'rock_climbing', 'indoor_climbing', 'bouldering',
      'surfing', 'kayaking', 'canoeing', 'paddleboarding',
      'triathlon', 'duathlon', 'athletics', 'track_and_field',
      'gymnastics', 'calisthenics', 'plyometrics',
      'kickboxing', 'boxing', 'mma', 'wrestling',
      'rugby', 'hockey', 'lacrosse', 'baseball', 'softball',
      'cricket', 'squash', 'racquetball', 'handball',
      'archery', 'shooting', 'fencing',
      'rowing_machine', 'treadmill', 'stair_climbing', 'stair_master'
    ];
    
    // Explicitly exclude walking and related activities
    const excludedActivities = [
      'walking', 'walk', 'strolling', 'leisurely_walk', 'casual_walk',
      'dog_walking', 'power_walking', 'brisk_walking',
      'commuting', 'transportation', 'travel'
    ];

    const exerciseSessions = sessions.filter((session: GoogleFitSession) => {
      // Check multiple fields for activity type
      const activityType = String(session.activityType || '').toLowerCase();
      const sessionName = String(session.name || '').toLowerCase();
      const sessionDescription = String(session.description || '').toLowerCase();
      const applicationName = String(session.application?.packageName || '').toLowerCase();
      
      // Log all session details for debugging
      console.log(`Processing session:`, {
        id: session.id,
        name: session.name,
        description: session.description,
        activityType: session.activityType,
        application: session.application?.packageName
      });
      
      // Check if it's explicitly excluded
      const isExcluded = excludedActivities.some(excluded => 
        activityType.includes(excluded) || 
        sessionName.includes(excluded) || 
        sessionDescription.includes(excluded) ||
        applicationName.includes(excluded)
      );
      
      if (isExcluded) {
        console.log(`Excluding session: ${session.name} (${session.description}) - activityType: ${session.activityType}`);
        return false;
      }
      
      // Check if it's an exercise activity - check all fields
      const isExercise = exerciseActivities.some(activity => 
        activityType.includes(activity) || 
        sessionName.includes(activity) || 
        sessionDescription.includes(activity) ||
        applicationName.includes(activity)
      );
      
      // Also check Google Fit activity type numbers for running (8, 9, 10)
      const isRunningByType = [8, 9, 10].includes(session.activityType);
      
      if (isExercise || isRunningByType) {
        console.log(`Including exercise session: ${session.name} (${session.description}) - activityType: ${session.activityType}, isRunningByType: ${isRunningByType}`);
        return true;
      }
      
      return false;
    });

    console.log(`Filtered to ${exerciseSessions.length} exercise sessions`);

    // Store sessions in database
    const sessionInserts = exerciseSessions.map(session => {
      // Determine the best activity type name
      let activityTypeName = 'unknown';
      if (session.name && session.name.trim()) {
        activityTypeName = session.name;
      } else if (session.activityType) {
        // Map Google Fit activity type numbers to names
        const activityTypeMap: { [key: number]: string } = {
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
        user_id: resolvedUserId,
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

    if (sessionInserts.length > 0) {
      const { error: sessionsError } = await supabaseClient
        .from('google_fit_sessions')
        .upsert(sessionInserts, { 
          onConflict: 'user_id,session_id',
          ignoreDuplicates: false 
        });

      if (sessionsError) {
        console.error('Error inserting sessions:', sessionsError);
        return new Response(JSON.stringify({ error: 'Failed to save sessions' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Now fetch detailed data for each day
    const dailyData: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayStartMillis = dayStart.getTime();
      const dayEndMillis = dayEnd.getTime();

      try {
        // Fetch aggregated data for the day
        const aggregateResponse = await makeGoogleFitRequest(
          'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
          {
            method: 'POST',
            body: JSON.stringify({
              aggregateBy: [
                { dataTypeName: 'com.google.step_count.delta' },
                { dataTypeName: 'com.google.calories.expended' },
                { dataTypeName: 'com.google.active_minutes' },
                { dataTypeName: 'com.google.heart_rate.bpm' },
                { dataTypeName: 'com.google.distance.delta' }
              ],
              bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
              startTimeMillis: dayStartMillis,
              endTimeMillis: dayEndMillis
            })
          }
        );

        if (aggregateResponse.ok) {
          const aggregateData: GoogleFitAggregateResponse = await aggregateResponse.json();
          const bucket = aggregateData.bucket?.[0];

          if (bucket) {
            let steps = 0;
            let caloriesBurned = 0;
            let activeMinutes = 0;
            let heartRateAvg = null;
            let distanceMeters = 0;

            // Process each dataset
            bucket.dataset.forEach(dataset => {
              dataset.point.forEach(point => {
                const value = point.value[0];
                if (!value) return;

                switch (dataset.dataSourceId) {
                  case 'derived:com.google.step_count.delta:com.google.android.gms:aggregated':
                    steps += value.intVal || 0;
                    break;
                  case 'derived:com.google.calories.expended:com.google.android.gms:aggregated':
                    caloriesBurned += value.fpVal || 0;
                    break;
                  case 'derived:com.google.active_minutes:com.google.android.gms:aggregated':
                    activeMinutes += value.intVal || 0;
                    break;
                  case 'derived:com.google.heart_rate.bpm:com.google.android.gms:aggregated':
                    if (value.fpVal) {
                      heartRateAvg = heartRateAvg ? (heartRateAvg + value.fpVal) / 2 : value.fpVal;
                    }
                    break;
                  case 'derived:com.google.distance.delta:com.google.android.gms:aggregated':
                    distanceMeters += value.fpVal || 0;
                    break;
                }
              });
            });

            // Get sessions for this day
            const daySessions = exerciseSessions.filter(session => {
              const sessionStart = new Date(parseInt(session.startTimeMillis));
              return sessionStart >= dayStart && sessionStart <= dayEnd;
            });

            dailyData.push({
              user_id: resolvedUserId,
              date: currentDate.toISOString().split('T')[0],
              steps,
              calories_burned: Math.round(caloriesBurned * 100) / 100,
              active_minutes: activeMinutes,
              distance_meters: Math.round(distanceMeters * 100) / 100,
              heart_rate_avg: heartRateAvg ? Math.round(heartRateAvg * 100) / 100 : undefined,
              sessions: daySessions,
              last_synced_at: new Date().toISOString(),
              sync_source: 'google_fit'
            });
          }
        }
      } catch (dayError) {
        console.error(`Error processing day ${currentDate.toISOString().split('T')[0]}:`, dayError);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Store daily data
    if (dailyData.length > 0) {
      const { error: dailyError } = await supabaseClient
        .from('google_fit_data')
        .upsert(dailyData as any, { 
          onConflict: 'user_id,date',
          ignoreDuplicates: false 
        });

      if (dailyError) {
        console.error('Error inserting daily data:', dailyError);
        return new Response(JSON.stringify({ error: 'Failed to save daily data' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Trigger automatic training activity update for today
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabaseClient.functions.invoke('auto-update-training', {
        body: { user_id: resolvedUserId, date: today },
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        }
      });
      console.log('Triggered automatic training activity update');
    } catch (updateError) {
      console.error('Error triggering training update:', updateError);
      // Don't fail the whole sync if training update fails
    }

    return new Response(JSON.stringify({ 
      success: true,
      sessions_synced: exerciseSessions.length,
      days_processed: dailyData.length,
      message: `Successfully synced ${exerciseSessions.length} sessions and ${dailyData.length} days of data`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-all-google-fit-data function:', error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
