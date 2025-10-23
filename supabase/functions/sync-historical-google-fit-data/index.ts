import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  exerciseActivities,
  excludedActivities,
  includedActivityCodes,
  excludedActivityCodes,
  activityTypeNames
} from '../_shared/google-fit-activities.ts';
import { normalizeActivityName } from '../_shared/google-fit-utils.ts';
import { fetchDayData, storeDayData } from '../_shared/google-fit-sync-core.ts';

interface HistoricalGoogleFitData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distanceMeters: number;
  heartRateAvg?: number;
  sessions: any[];
  date: string;
}

function filterExerciseSessions(sessions: any[]): any[] {
  return sessions.filter((session: any) => {
    const activityTypeRaw = session.activityType ?? session.activityTypeId ?? session.activity ?? '';
    const activityType = String(activityTypeRaw || '').toLowerCase();
    const sessionName = String(session.name || '').toLowerCase();
    const sessionDescription = String(session.description || '').toLowerCase();
    const numericType = Number(activityTypeRaw);
    const numericKey = Number.isFinite(numericType) ? String(numericType) : null;

    // Exclude explicitly excluded activities
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

    // Include if it's in the included activity codes
    if (numericKey && includedActivityCodes.has(numericKey)) {
      return true;
    }

    // Include if it matches exercise activities
    return exerciseActivities.some(activity => 
      activityType.includes(activity) || 
      sessionName.includes(activity) || 
      sessionDescription.includes(activity)
    );
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { accessToken, daysBack = 30 } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing access token' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user ID from request body (since verify_jwt = false)
    const { userId, accessToken, daysBack = 30 } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔄 Starting IMPROVED historical sync for user ${userId}, fetching ${daysBack} days back`);

    // Fetch historical data from Google Fit API (NOW WITH SESSIONS!)
    const historicalData = await fetchHistoricalDataWithSessions(accessToken, daysBack);
    
    if (!historicalData || historicalData.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No historical data found',
          data: { syncedDays: 0, totalDays: daysBack }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Store historical data in database
    const syncedDays = await storeHistoricalData(supabaseClient, userId, historicalData);

    console.log(`✅ Historical sync completed: ${syncedDays} days synced for user ${userId}`);
    console.log(`📊 Sessions found: ${historicalData.reduce((sum, day) => sum + day.sessions.length, 0)} total`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${syncedDays} days of historical data`,
        data: {
          syncedDays,
          totalDays: daysBack,
          totalSessions: historicalData.reduce((sum, day) => sum + day.sessions.length, 0),
          dateRange: {
            start: historicalData[historicalData.length - 1]?.date,
            end: historicalData[0]?.date
          }
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Historical sync error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to sync historical data' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

/**
 * IMPROVED: Fetch historical data WITH session information
 */
async function fetchHistoricalDataWithSessions(
  accessToken: string, 
  daysBack: number
): Promise<HistoricalGoogleFitData[]> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);
  
  console.log(`📅 Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  const historicalData: HistoricalGoogleFitData[] = [];
  
  // Process each day individually to get detailed data
  for (let i = 0; i < daysBack; i++) {
    const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    try {
      // Fetch data for this specific day (NOW WITH SESSIONS!)
      const dayData = await fetchDayDataWithSessions(accessToken, startOfDay, endOfDay);
      
      if (dayData) {
        historicalData.push({
          ...dayData,
          date: currentDate.toISOString().split('T')[0]
        });
        
        if (dayData.sessions.length > 0) {
          console.log(`   📊 ${currentDate.toISOString().split('T')[0]}: ${dayData.sessions.length} sessions found`);
        }
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (error) {
      console.warn(`⚠️  Failed to fetch data for ${currentDate.toISOString().split('T')[0]}:`, error);
      // Continue with other days even if one fails
    }
  }

  return historicalData;
}

/**
 * IMPROVED: Fetch day data WITH sessions from Google Fit
 */
async function fetchDayDataWithSessions(
  accessToken: string, 
  startOfDay: Date, 
  endOfDay: Date
): Promise<HistoricalGoogleFitData | null> {
  
  // Helper function for aggregate API calls
  const aggregate = async (dataTypeName: string) => {
    const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

    return await res.json();
  };

  try {
    // Use shared core module for comprehensive data extraction
    const dayData = await fetchDayData(accessToken, startOfDay, endOfDay);
    
    const steps = dayData.steps;
    const caloriesBurned = dayData.caloriesBurned;
    const activeMinutes = dayData.activeMinutes;
    const heartRateAvg = dayData.heartRateAvg;
    const distanceMeters = dayData.distanceMeters;
    const sessions = dayData.sessions;

    // Only return data if there's meaningful activity
    if (steps > 0 || caloriesBurned > 0 || sessions.length > 0) {
      return {
        steps,
        caloriesBurned,
        activeMinutes,
        distanceMeters,
        heartRateAvg,
        sessions, // ← NOW HAS ACTUAL SESSION DATA!
        date: startOfDay.toISOString().split('T')[0]
      };
    }

    return null;

  } catch (error) {
    console.error(`❌ Error fetching day data for ${startOfDay.toISOString().split('T')[0]}:`, error);
    return null;
  }
}

/**
 * Store historical data in database (including sessions)
 */
async function storeHistoricalData(
  supabaseClient: any, 
  userId: string, 
  historicalData: HistoricalGoogleFitData[]
): Promise<number> {
  let syncedDays = 0;

  // Process data in batches to avoid overwhelming the database
  const batchSize = 10;
  for (let i = 0; i < historicalData.length; i += batchSize) {
    const batch = historicalData.slice(i, i + batchSize);
    
    // Store main Google Fit data
    const records = batch.map(data => ({
      user_id: userId,
      date: data.date,
      steps: data.steps,
      calories_burned: data.caloriesBurned,
      active_minutes: data.activeMinutes,
      distance_meters: data.distanceMeters,
      heart_rate_avg: data.heartRateAvg,
      sessions: data.sessions || [],
      last_synced_at: new Date().toISOString(),
      sync_source: 'historical_sync_v2' // Mark as improved version
    }));

    const { error } = await supabaseClient
      .from('google_fit_data')
      .upsert(records, { onConflict: 'user_id,date' });

    if (error) {
      console.error('❌ Error storing historical data batch:', error);
    } else {
      syncedDays += records.length;
    }

    // ✨ NEW: Store sessions in google_fit_sessions table
    for (const data of batch) {
      if (data.sessions && data.sessions.length > 0) {
        const sessionRecords = data.sessions.map((s: any) => {
          const sessionId = s.id || s.session_id || `${s.startTimeMillis}-${s.endTimeMillis}`;
          const numericType = Number(s._activityTypeNumeric);
          const activityLabel =
            s.name ||
            s.description ||
            (Number.isFinite(numericType) && activityTypeNames[numericType]) ||
            String(s.activity_type || s.activityType || s.activity || 'workout');
          
          return {
            user_id: userId,
            session_id: String(sessionId),
            start_time: s.startTimeMillis ? new Date(Number(s.startTimeMillis)).toISOString() : new Date().toISOString(),
            end_time: s.endTimeMillis ? new Date(Number(s.endTimeMillis)).toISOString() : new Date().toISOString(),
            activity_type: activityLabel,
            name: s.name || activityLabel || null,
            description: s.description || activityLabel || null,
            source: 'google_fit_historical',
            raw: s
          };
        });

        const { error: sessionError } = await supabaseClient
          .from('google_fit_sessions')
          .upsert(sessionRecords, { onConflict: 'user_id,session_id' });

        if (sessionError) {
          console.error(`⚠️  Error storing sessions for ${data.date}:`, sessionError);
        } else {
          console.log(`   ✅ Stored ${sessionRecords.length} sessions for ${data.date}`);
        }
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return syncedDays;
}
