import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  exerciseActivities,
  excludedActivities,
  includedActivityCodes,
  excludedActivityCodes,
  activityTypeNames
} from '../_shared/google-fit-activities.ts';
import { normalizeActivityName, isExerciseSession } from '../_shared/google-fit-utils.ts';
import { fetchDayData, storeDayData } from '../_shared/google-fit-sync-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, expires, pragma',
};

interface GoogleFitData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distanceMeters: number;
  heartRateAvg?: number;
  sessions?: any[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from request body (since verify_jwt = false)
    const { userId, accessToken = null, date = new Date().toISOString().split('T')[0] } = await req.json();
    
    if (!userId) {
      throw new Error('Missing userId in request body');
    }
    
    console.log(`Fetching Google Fit data for user: ${userId}`);

    // Get access token from request or database
    let googleToken = accessToken;

    if (!googleToken) {
      // Get token from database
      const { data: tokenData, error: tokenError } = await supabase
        .from('google_tokens')
        .select('access_token, expires_at, refresh_token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tokenError) {
        console.error('Error fetching Google token:', tokenError);
        if (tokenError.code === '22P02') {
          throw new Error('Invalid user ID format - please sign in again');
        }
        throw new Error('Failed to fetch Google Fit token from database');
      }
      
      if (!tokenData?.access_token) {
        console.log(`No Google Fit token found for user: ${userId}`);
        throw new Error('No valid Google Fit token found - please connect your Google Fit account in settings');
      }

      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      
      if (expiresAt <= now) {
        console.log('Token expired, attempting refresh...');
        
        // Try to refresh the token
        try {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
              client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
              refresh_token: tokenData.refresh_token,
              grant_type: 'refresh_token',
            }),
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            const newExpiresAt = new Date(now.getTime() + (refreshData.expires_in * 1000));

            // Update the token in the database
            await supabase
              .from('google_tokens')
              .update({
                access_token: refreshData.access_token,
                expires_at: newExpiresAt.toISOString(),
                last_refreshed_at: now.toISOString(),
                refresh_count: tokenData.refresh_count + 1,
                updated_at: now.toISOString()
              })
              .eq('user_id', userId)
              .eq('is_active', true);

            googleToken = refreshData.access_token;
            console.log('Token refreshed successfully');
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          throw new Error('No valid Google Fit token found - background token renewal should handle this');
        }
      } else {
        googleToken = tokenData.access_token;
      }
    }

    // Calculate time range
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Helper to generate cache key
    const generateRequestHash = (endpoint: string, params: any) => {
      const str = JSON.stringify(params);
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `${hash}`;
    };

    // Helper to check cache
    const checkCache = async (endpoint: string, params: any) => {
      const requestHash = generateRequestHash(endpoint, params);
      const { data: cache } = await supabase
        .from('google_fit_cache')
        .select('response_data')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .eq('request_hash', requestHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      return cache?.response_data;
    };

    // Helper to store cache
    const storeCache = async (endpoint: string, params: any, data: any) => {
      const requestHash = generateRequestHash(endpoint, params);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Cache for 15 minutes

      await supabase
        .from('google_fit_cache')
        .upsert({
          user_id: userId,
          endpoint,
          request_hash: requestHash,
          response_data: data,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'user_id,endpoint,request_hash'
        });
    };

    // Fetch Google Fit data with caching
    const aggregate = async (dataTypeName: string) => {
      const endpoint = 'dataset:aggregate';
      const params = {
        dataTypeName,
        startTimeMillis: startOfDay.getTime(),
        endTimeMillis: endOfDay.getTime()
      };

      // Check cache first
      const cached = await checkCache(endpoint, params);
      if (cached) {
        console.log(`Cache hit for ${dataTypeName}`);
        return cached;
      }

      // Make API call if not cached
      const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName }],
          bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
          startTimeMillis: startOfDay.getTime(),
          endTimeMillis: endOfDay.getTime()
        })
      });

      if (res.status === 401) {
        throw new Error('Google Fit token expired');
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Google Fit API error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      
      // Store in cache
      await storeCache(endpoint, params, data);
      
      return data;
    };

    // Use shared core module for comprehensive data extraction
    const dayData = await fetchDayData(googleToken, startOfDay, endOfDay, { useCache: false });
    
    const steps = dayData.steps;
    const caloriesBurned = dayData.caloriesBurned;
    const activeMinutes = dayData.activeMinutes;
    const heartRateAvg = dayData.heartRateAvg;
    const baseDistanceMeters = dayData.distanceMeters;
    const normalizedSessions = dayData.sessions;

    // Using sessions from shared core module (comprehensive data extraction)

    // Calculate distance for exercise sessions
    let exerciseDistanceMeters = baseDistanceMeters;
    if (normalizedSessions.length > 0) {
      for (const session of normalizedSessions) {
        try {
          const sessionStartTime = new Date(Number(session.startTimeMillis));
          const sessionEndTime = new Date(Number(session.endTimeMillis));
          
          const sessionDistanceRes = await fetch(
            "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
            {
              method: "POST",
              headers: {
                'Authorization': `Bearer ${googleToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                aggregateBy: [{ dataTypeName: 'com.google.distance.delta' }],
                bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
                startTimeMillis: sessionStartTime.getTime(),
                endTimeMillis: sessionEndTime.getTime(),
                filter: [{
                  dataSourceId: session.dataSourceId || undefined
                }].filter(f => f.dataSourceId)
              }),
            }
          );
          
          if (sessionDistanceRes.ok) {
            const sessionDistanceData = await sessionDistanceRes.json();
            const sessionDistance = sessionDistanceData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
            exerciseDistanceMeters += sessionDistance;
            // Attach computed distance to session
            try {
              (session as any)._computed_distance_meters = sessionDistance;
            } catch {}
          }
        } catch (error) {
          console.warn('Failed to get distance for session:', error);
        }
      }
    }

    // Store data in database
    const { error: upsertErr } = await supabase
      .from('google_fit_data')
      .upsert({
        user_id: userId,
        date,
        steps,
        calories_burned: caloriesBurned,
        active_minutes: activeMinutes,
        distance_meters: exerciseDistanceMeters,
        heart_rate_avg: heartRateAvg,
        sessions: normalizedSessions,
        last_synced_at: new Date().toISOString(),
        sync_source: 'google_fit'
      }, { onConflict: 'user_id,date' });

    if (upsertErr) throw upsertErr;

    // Store sessions
    if (Array.isArray(normalizedSessions) && normalizedSessions.length > 0) {
      const mapped = normalizedSessions.map((s: any) => {
        const sessionId = s.id || s.session_id || `${s.startTimeMillis}-${s.endTimeMillis}`;
        const numericType = Number(s._activityTypeNumeric);
        const activityLabel =
          s.name ||
          s.description ||
          (Number.isFinite(numericType) && activityTypeNames[numericType]) ||
          String(s.activity_type || s.activityType || s.activity || 'run');
        return {
          user_id: userId,
          session_id: String(sessionId),
          start_time: s.startTimeMillis ? new Date(Number(s.startTimeMillis)).toISOString() : new Date().toISOString(),
          end_time: s.endTimeMillis ? new Date(Number(s.endTimeMillis)).toISOString() : new Date().toISOString(),
          activity_type: activityLabel,
          name: s.name || activityLabel || null,
          description: s.description || activityLabel || null,
          source: 'google_fit',
          raw: { ...s, distance_meters: (s as any)._computed_distance_meters }
        };
      });

      const batchSize = 50;
      for (let i = 0; i < mapped.length; i += batchSize) {
        const chunk = mapped.slice(i, i + batchSize);
        await supabase
          .from('google_fit_sessions')
          .upsert(chunk, { onConflict: 'user_id,session_id' });
      }
    }

    // Return the data
    const googleFitData: GoogleFitData = {
      steps,
      caloriesBurned,
      activeMinutes,
      distanceMeters: exerciseDistanceMeters,
      heartRateAvg,
      sessions: normalizedSessions
    };

    return new Response(JSON.stringify({
      success: true,
      data: googleFitData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching Google Fit data:', error);

    // Special handling for token expiry
    if (error.message?.includes('token expired') || error.message?.includes('401')) {
      return new Response(JSON.stringify({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
