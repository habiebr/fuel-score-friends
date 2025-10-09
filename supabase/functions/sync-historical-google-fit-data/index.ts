import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface HistoricalGoogleFitData {
  steps: number;
  caloriesBurned: number;
  activeMinutes: number;
  distanceMeters: number;
  heartRateAvg?: number;
  sessions?: any[];
  date: string;
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

    // Get user from request headers
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid user token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Starting historical sync for user ${user.id}, fetching ${daysBack} days back`);

    // Fetch historical data from Google Fit API
    const historicalData = await fetchHistoricalData(accessToken, daysBack);
    
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
    const syncedDays = await storeHistoricalData(supabaseClient, user.id, historicalData);

    console.log(`Historical sync completed: ${syncedDays} days synced for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully synced ${syncedDays} days of historical data`,
        data: {
          syncedDays,
          totalDays: daysBack,
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
    console.error('Historical sync error:', error);
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

async function fetchHistoricalData(accessToken: string, daysBack: number): Promise<HistoricalGoogleFitData[]> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (daysBack - 1) * 24 * 60 * 60 * 1000);
  
  console.log(`Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  const historicalData: HistoricalGoogleFitData[] = [];
  
  // Process each day individually to get detailed data
  for (let i = 0; i < daysBack; i++) {
    const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    try {
      // Fetch data for this specific day
      const dayData = await fetchDayData(accessToken, startOfDay, endOfDay);
      
      if (dayData) {
        historicalData.push({
          ...dayData,
          date: currentDate.toISOString().split('T')[0]
        });
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.warn(`Failed to fetch data for ${currentDate.toISOString().split('T')[0]}:`, error);
      // Continue with other days even if one fails
    }
  }

  return historicalData;
}

async function fetchDayData(accessToken: string, startOfDay: Date, endOfDay: Date): Promise<HistoricalGoogleFitData | null> {
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
    // Fetch all metrics in parallel
    const [stepsData, caloriesData, activeMinutesData, heartRateData, distanceData] = await Promise.all([
      aggregate('com.google.step_count.delta'),
      aggregate('com.google.calories.expended'),
      aggregate('com.google.active_minutes'),
      aggregate('com.google.heart_rate.bpm').catch(() => null),
      aggregate('com.google.distance.delta').catch(() => null)
    ]);

    // Extract values
    const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    const caloriesBurned = caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
    const activeMinutes = activeMinutesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    const heartRateAvg = heartRateData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;
    const distanceMeters = distanceData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;

    // Only return data if there's meaningful activity (steps > 0 or calories > 0)
    if (steps > 0 || caloriesBurned > 0) {
      return {
        steps,
        caloriesBurned,
        activeMinutes,
        distanceMeters,
        heartRateAvg,
        sessions: [], // Could be enhanced to fetch actual sessions
        date: startOfDay.toISOString().split('T')[0]
      };
    }

    return null;

  } catch (error) {
    console.error(`Error fetching day data for ${startOfDay.toISOString().split('T')[0]}:`, error);
    return null;
  }
}

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
      sync_source: 'historical_sync'
    }));

    const { error } = await supabaseClient
      .from('google_fit_data')
      .upsert(records, { onConflict: 'user_id,date' });

    if (error) {
      console.error('Error storing historical data batch:', error);
    } else {
      syncedDays += records.length;
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return syncedDays;
}
