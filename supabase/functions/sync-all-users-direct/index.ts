import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { 
  includedActivityCodes, 
  excludedActivityCodes,
  activityTypeNames 
} from '../_shared/google-fit-activities.ts';
import { normalizeSession as normalizeGoogleFitSession } from '../_shared/google-fit-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, expires, pragma',
};

function normalizeSession(session: any) {
  const copy = { ...session };
  const activityTypeRaw = copy.activityType ?? copy.activityTypeId ?? copy.activity ?? '';
  const numericType = Number(activityTypeRaw);
  if (!Number.isNaN(numericType)) {
    copy._activityTypeNumeric = numericType;
  }
  if (!copy.name || !String(copy.name).trim()) {
    const friendly = !Number.isNaN(numericType) ? activityTypeNames[numericType] : null;
    if (friendly) {
      copy.name = friendly;
      if (!copy.description) {
        copy.description = friendly;
      }
    }
  }
  return copy;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    let daysBack = 30;
    try {
      if (req.method !== 'OPTIONS') {
        const body = await req.json();
        if (body && typeof body.daysBack === 'number' && body.daysBack > 0) {
          daysBack = Math.min(60, Math.floor(body.daysBack)); // cap to 60 to avoid abuse
        }
      }
    } catch {}
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting comprehensive Google Fit sync for all users (last ${daysBack} days)...`);

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
        startDate.setDate(startDate.getDate() - daysBack);

T        // Fetch sessions (handle pagination)
        let exerciseSessions: any[] = [];
        let pageToken: string | undefined = undefined;
        do {
          const url = new URL('https://www.googleapis.com/fitness/v1/users/me/sessions');
          url.searchParams.set('startTime', startDate.toISOString());
          url.searchParams.set('endTime', endDate.toISOString());
          if (pageToken) url.searchParams.set('pageToken', pageToken);
          const sessionsResponse = await fetch(url.toString(), {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          if (!sessionsResponse.ok) {
            break;
          }
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

          const filtered = sessions.filter((session: any) => {
            const activityTypeRaw = session.activityType ?? session.activityTypeId ?? session.activity ?? '';
            const activityType = String(activityTypeRaw || '').toLowerCase();
            const sessionName = String(session.name || '').toLowerCase();
            const sessionDescription = String(session.description || '').toLowerCase();
            const applicationName = String(session.application?.packageName || '').toLowerCase();
            const numericType = Number(activityTypeRaw);
            const numericKey = Number.isFinite(numericType) ? String(numericType) : null;

            // Check if it's explicitly excluded
            const isExcludedByText = excludedActivities.some(excluded => 
              activityType.includes(excluded) || 
              sessionName.includes(excluded) || 
              sessionDescription.includes(excluded) || 
              applicationName.includes(excluded)
            );

            if (numericKey && excludedActivityCodes.has(numericKey)) {
              return false;
            }

            // Check if it's an exercise activity
            const isExercise = exerciseActivities.some(activity => 
              activityType.includes(activity) || 
              sessionName.includes(activity) || 
              sessionDescription.includes(activity) || 
              applicationName.includes(activity)
            );

            if (numericKey && includedActivityCodes.has(numericKey)) {
              return true;
            }

            if (isExcludedByText) {
              return false;
            }

            return isExercise;
          });
          const normalizedBatch = filtered.map(normalizeSession);
          exerciseSessions.push(...normalizedBatch);
          console.log(`Accumulated ${exerciseSessions.length} exercise sessions for user ${token.user_id}`);
          pageToken = sessionsData.nextPageToken;
        } while (pageToken);

        // Store sessions in database
        if (exerciseSessions.length > 0) {
            const sessionInserts = exerciseSessions.map((session: any) => {
              const numericType = Number(session._activityTypeNumeric ?? session.activityType ?? session.activity);
              const friendlyName = (!Number.isNaN(numericType) && activityTypeNames[numericType]) || null;
              const activityTypeName = String(session.name || session.description || friendlyName || 'Workout').trim();
              return {
                user_id: token.user_id,
                session_id: session.id,
                start_time: new Date(parseInt(session.startTimeMillis)).toISOString(),
                end_time: new Date(parseInt(session.endTimeMillis)).toISOString(),
                activity_type: activityTypeName,
                name: session.name || activityTypeName,
                description: session.description || activityTypeName,
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

        // Fetch daily aggregates for last N days and upsert into google_fit_data
        try {
          const aggBody = {
            aggregateBy: [
              { dataTypeName: 'com.google.step_count.delta' },
              { dataTypeName: 'com.google.distance.delta' },
              { dataTypeName: 'com.google.calories.expended' },
              { dataTypeName: 'com.google.active_minutes' },
              { dataTypeName: 'com.google.heart_rate.bpm' }
            ],
            bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
            startTimeMillis: startDate.getTime(),
            endTimeMillis: endDate.getTime()
          } as any;

          const aggResp = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(aggBody)
          });

          if (aggResp.ok) {
            const aggData = await aggResp.json();
            const buckets = aggData.bucket || [];
            for (const b of buckets) {
              const startMs = parseInt(b.startTimeMillis || '0');
              if (!startMs) continue;
              const day = new Date(startMs).toISOString().slice(0, 10);
              let steps = 0, distance = 0, calories = 0, activeMinutes = 0;
              let hrSum = 0, hrCount = 0;
              for (const ds of b.dataset || []) {
                for (const p of ds.point || []) {
                  const val = (p.value && p.value[0]) || {};
                  const fp = val.fpVal ?? val.fpval ?? val.fp ?? val.intVal ?? val.intval ?? 0;
                  const dt = p.dataTypeName || ds.dataSourceId || '';
                  if (dt.includes('step_count')) steps += Number(fp) || 0;
                  if (dt.includes('distance')) distance += Number(fp) || 0;
                  if (dt.includes('calories')) calories += Number(fp) || 0;
                  if (dt.includes('active_minutes')) activeMinutes += Number(fp) || 0;
                  if (dt.includes('heart_rate')) { hrSum += Number(fp) || 0; hrCount += 1; }
                }
              }
              const heartRateAvg = hrCount > 0 ? Math.round(hrSum / hrCount) : null;
              // Attach sessions that overlap this day (simple by date)
              const daySessions = (exerciseSessions || []).filter((s: any) => {
                const sDate = new Date(parseInt(s.startTimeMillis)).toISOString().slice(0, 10);
                return sDate === day;
              }).map((s: any) => {
                const numericType = Number(s._activityTypeNumeric ?? s.activityType ?? s.activity);
                const friendly = (!Number.isNaN(numericType) && activityTypeNames[numericType]) || null;
                return {
                  id: s.id,
                  name: s.name || friendly || s.description || 'Workout',
                  activityType: s.activityType || friendly || s.description || 'Workout',
                  _activityTypeNumeric: Number.isNaN(numericType) ? null : numericType
                };
              });

              const { error: upErr } = await supabaseClient
                .from('google_fit_data')
                .upsert({
                  user_id: token.user_id,
                  date: day,
                  steps,
                  distance_meters: distance,
                  calories_burned: calories,
                  active_minutes: activeMinutes || null,
                  heart_rate_avg: heartRateAvg,
                  sessions: daySessions
                }, { onConflict: 'user_id,date' });
              if (upErr) {
                console.warn('Upsert google_fit_data failed', upErr);
              }
            }
          } else {
            console.warn('Aggregate fetch failed:', await aggResp.text());
          }
        } catch (e) {
          console.warn('Aggregate fetch error:', e);
        }

        // Add a small delay between users to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        results.successful_syncs++;
        console.log(`Successfully synced user ${token.user_id}`);

      } catch (error) {
        console.error(`Error processing user ${token.user_id}:`, error);
        results.failed_syncs++;
        // @ts-ignore
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
      // @ts-ignore
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
