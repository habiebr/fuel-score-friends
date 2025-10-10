import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleFitData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distanceMeters: number;
  heartRateAvg?: number;
  sessions?: any[];
}

// Exercise activities to include
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

// Activities to explicitly exclude
const excludedActivities = [
  'walking', 'walk', 'strolling', 'leisurely_walk', 'casual_walk',
  'dog_walking', 'power_walking', 'brisk_walking',
  'commuting', 'transportation', 'travel'
];

// Numeric Google Fit activity codes that should always be treated as runs / workouts we care about
const includedActivityCodes = new Set([
  '8', // Running
  '9', // Jogging
  '10', // Sprinting
  '57', // Running on sand
  '58', // Running on stairs
  '59', // Running on treadmill
  '70', // Mountain biking
  '71', // Road biking
  '72', // Trail running
  '108', // Nordic walking (treat as run)
  '112', // CrossFit
  '113', // Functional training
  '116', // High-intensity interval training
  '117', // Spinning
  '118', // Stair climbing
  '119', // Indoor cycling
  '120', // Aquabiking
  '122', // Treadmill running
  '123', // Bicycle racing
  '124', // Jumping rope
  '129', // Roller skiing
  '134', // Trail biking
  '135', // High-intensity interval training
  '136', // Jumping rope
  '138', // Mountain biking
  '157', // Hiking (count as run equivalent)
  '169', // Swimming
  '170', // Swimming (open water)
  '171', // Swimming (pool)
  '173', // Running (general)
  '174', // Running on treadmill
  '175', // Running outdoors
  '176', // Running - high intensity
  '177', // Running - sprint
  '178', // Running - intervals
  '179', // Running - long distance
  '180', // Running - recovery
  '181', // Running - tempo
  '182', // Running - track
  '183', // Running - cross country
  '184', // Running - hill
  '185', // Running - race
  '186', // Running - warmup
  '187', // Running - cooldown
  '188', // Running - fartlek
  '3000', // Custom running activity
  '3001'
]);

const excludedActivityCodes = new Set([
  '7', // Walking
  '93', // Leisure walking
  '94', // Walking (fitness) - treat as excluded unless keyword says otherwise
  '143', // Wheelchair
  '145'  // Fitness walking
]);

const activityTypeNames: Record<number, string> = {
  7: 'Walking',
  8: 'Running',
  9: 'Jogging',
  10: 'Sprinting',
  57: 'Beach Run',
  58: 'Stair Run',
  59: 'Treadmill Run',
  70: 'Extreme Biking',
  71: 'Road Biking',
  72: 'Trail Run',
  108: 'Nordic Walking',
  112: 'CrossFit',
  113: 'Functional Training',
  116: 'HIIT',
  117: 'Spinning',
  118: 'Stair Climb',
  119: 'Indoor Cycling',
  122: 'Treadmill Run',
  123: 'Cycle Race',
  124: 'Jump Rope',
  134: 'Trail Bike',
  135: 'HIIT',
  138: 'Mountain Biking',
  157: 'Hiking',
  169: 'Swimming',
  170: 'Open Water Swim',
  171: 'Pool Swim',
  173: 'Running',
  174: 'Treadmill Running',
  175: 'Outdoor Running',
  176: 'High Intensity Run',
  177: 'Sprint',
  178: 'Interval Run',
  179: 'Long Run',
  180: 'Recovery Run',
  181: 'Tempo Run',
  182: 'Track Run',
  183: 'Cross Country Run',
  184: 'Hill Run',
  185: 'Race',
  186: 'Warmup Run',
  187: 'Cooldown Run',
  188: 'Fartlek Run',
};

function normalizeActivityName(session: any): string | null {
  if (!session) return null;
  const existing = String(session.name || session.description || '').trim();
  if (existing) return existing;
  const numericType = Number(session.activityType ?? session.activityTypeId ?? session.activity);
  if (!Number.isNaN(numericType) && activityTypeNames[numericType]) {
    return activityTypeNames[numericType];
  }
  return null;
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

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      console.error('JWT validation failed:', userError);
      throw new Error('Unauthorized - invalid or expired token');
    }
    
    // Validate user ID
    if (!user.id || user.id === 'undefined') {
      console.error('Invalid user ID:', user.id);
      throw new Error('Invalid user ID - please sign in again');
    }
    
    console.log(`Fetching Google Fit data for user: ${user.id}`);

    // Get access token from request or database
    const { accessToken = null, date = new Date().toISOString().split('T')[0] } = await req.json();
    let googleToken = accessToken;

    if (!googleToken) {
      // Get token from database
      const { data: tokenData, error: tokenError } = await supabase
        .from('google_tokens')
        .select('access_token, expires_at, refresh_token')
        .eq('user_id', user.id)
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
        console.log(`No Google Fit token found for user: ${user.id}`);
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
              .eq('user_id', user.id)
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
        .eq('user_id', user.id)
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
          user_id: user.id,
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

    // Fetch all metrics in parallel
    const [stepsData, caloriesData, activeMinutesData, heartRateData] = await Promise.all([
      aggregate('com.google.step_count.delta'),
      aggregate('com.google.calories.expended'),
      aggregate('com.google.active_minutes'),
      aggregate('com.google.heart_rate.bpm').catch(() => null)
    ]);

    // Extract values
    const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    const caloriesBurned = caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
    const activeMinutes = activeMinutesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    const heartRateAvg = heartRateData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;

    // Fetch sessions with caching
    const endpoint = 'sessions';
    const params = {
      startTime: startOfDay.toISOString(),
      endTime: endOfDay.toISOString()
    };

    // Check cache first
    let sessions: any[] = [];
    const cachedSessions = await checkCache(endpoint, params);
    if (cachedSessions) {
      console.log('Cache hit for sessions');
      sessions = cachedSessions.session || [];
    } else {
      // Make API call if not cached
      const sessionsRes = await fetch(
        `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`,
        { headers: { 'Authorization': `Bearer ${googleToken}` } }
      );

      if (sessionsRes.status === 401) {
        throw new Error('Google Fit token expired');
      }
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        sessions = sessionsData.session || [];
        // Store in cache
        await storeCache(endpoint, params, sessionsData);
      }
    }

    // Filter sessions to only include exercise activities (with numeric code fallback)
    const filteredSessions = sessions.filter((session: any) => {
      const activityTypeRaw = session.activityType ?? session.activityTypeId ?? session.activity ?? '';
      const activityType = String(activityTypeRaw || '').toLowerCase();
      const sessionName = String(session.name || '').toLowerCase();
      const sessionDescription = String(session.description || '').toLowerCase();
      const numericType = Number(activityTypeRaw);

      const numericKey = Number.isFinite(numericType) ? String(numericType) : null;
      if (numericKey && excludedActivityCodes.has(numericKey)) {
        return false;
      }

      const isExplicitlyExcluded = excludedActivities.some(excluded => 
        activityType.includes(excluded) || 
        sessionName.includes(excluded) || 
        sessionDescription.includes(excluded)
      );
      if (isExplicitlyExcluded && !(numericKey && includedActivityCodes.has(numericKey))) {
        return false;
      }

      if (numericKey && includedActivityCodes.has(numericKey)) {
        return true;
      }

      return exerciseActivities.some(activity => 
        activityType.includes(activity) || 
        sessionName.includes(activity) || 
        sessionDescription.includes(activity)
      );
    });

    const normalizedSessions = filteredSessions.map((session: any) => {
      const copy = { ...session };
      const numericType = Number(copy.activityType ?? copy.activityTypeId ?? copy.activity);
      if (!Number.isNaN(numericType)) {
        copy._activityTypeNumeric = numericType;
        if (!copy.activityType) {
          copy.activityType = numericType;
        }
      }
      const friendlyName = normalizeActivityName(copy);
      if (friendlyName) {
        copy.name = friendlyName;
        if (!copy.description) {
          copy.description = friendlyName;
        }
      }
      return copy;
    });

    // Calculate distance for exercise sessions
    let exerciseDistanceMeters = 0;
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
        user_id: user.id,
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
          user_id: user.id,
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
