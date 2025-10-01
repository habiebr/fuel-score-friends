import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ParsedActivityData {
  sessions: Array<{
    timestamp: string;
    activityType: string;
    totalDistance: number;
    totalCalories: number;
    avgHeartRate: number;
    maxHeartRate: number;
    avgCadence: number;
    avgPower: number;
    maxSpeed: number;
    totalAscent: number;
    duration: number;
    activeMinutes: number;
  }>;
  records: any[];
  gpsPoints: any[];
  heartRateZones: {
    zone1: number;
    zone2: number;
    zone3: number;
    zone4: number;
    zone5: number;
  };
  totalRecords: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { parsedData }: { parsedData: ParsedActivityData } = await req.json();
    
    console.log(`Processing ${parsedData.sessions.length} sessions with ${parsedData.totalRecords} records`);
    
    // Process each session from the FIT file
    for (const session of parsedData.sessions) {
      const sessionDate = new Date(session.timestamp).toISOString().split('T')[0];
      
      // Prepare detailed metrics
      const detailedMetrics = {
        avgCadence: session.avgCadence,
        avgPower: session.avgPower,
        maxSpeed: session.maxSpeed,
        totalAscent: session.totalAscent,
        duration: session.duration
      };
      
      // Insert/update wearable_data with rich metrics
      const { error: upsertError } = await supabase
        .from('wearable_data')
        .upsert({
          user_id: user.id,
          date: sessionDate,
          calories_burned: Math.round(session.totalCalories),
          active_minutes: session.activeMinutes,
          heart_rate_avg: Math.round(session.avgHeartRate),
          max_heart_rate: session.maxHeartRate,
          distance_meters: Math.round(session.totalDistance),
          elevation_gain: Math.round(session.totalAscent),
          avg_cadence: Math.round(session.avgCadence),
          avg_power: Math.round(session.avgPower),
          max_speed: session.maxSpeed,
          activity_type: session.activityType,
          heart_rate_zones: parsedData.heartRateZones,
          gps_data: parsedData.gpsPoints.slice(0, 1000), // Limit GPS points to 1000
          detailed_metrics: detailedMetrics
        }, {
          onConflict: 'user_id,date'
        });

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionsImported: parsedData.sessions.length,
        totalRecords: parsedData.totalRecords
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error processing parsed FIT data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

// Note: FIT file parsing now happens in the browser using fit-file-parser library
// This edge function now receives pre-parsed data and stores it in the database
