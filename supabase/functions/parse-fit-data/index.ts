import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

    const { fitData } = await req.json();
    
    // Decode base64 .fit file data
    const binaryData = Uint8Array.from(atob(fitData), c => c.charCodeAt(0));
    
    console.log(`Processing FIT file of size: ${binaryData.length} bytes`);
    
    // Parse .fit file with enhanced parser
    const parsedData = await parseFitFile(binaryData);
    
    console.log(`Parsed ${parsedData.sessions.length} sessions with ${parsedData.records.length} records`);
    
    // Store each session
    for (const session of parsedData.sessions) {
      const sessionDate = new Date(session.timestamp).toISOString().split('T')[0];
      
      const { data: wearableData, error: upsertError } = await supabase
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
          avg_temperature: session.avgTemperature ? Math.round(session.avgTemperature) : null,
          training_effect: session.trainingEffect || null,
          recovery_time: session.recoveryTime || null,
          heart_rate_zones: parsedData.heartRateZones,
          gps_data: parsedData.gpsPoints.slice(0, 500), // Limit GPS points
          detailed_metrics: {
            duration: session.duration
          }
        }, {
          onConflict: 'user_id,date'
        })
        .select('id')
        .single();

      if (upsertError) {
        console.error('Upsert error:', upsertError);
        throw upsertError;
      }

      // Store lap data if available
      if (parsedData.laps && parsedData.laps.length > 0 && wearableData) {
        const lapsToInsert = parsedData.laps.map((lap: any, index: number) => ({
          user_id: user.id,
          wearable_data_id: wearableData.id,
          lap_index: index + 1,
          start_time: lap.startTime,
          total_time: lap.totalTime,
          total_distance: lap.totalDistance,
          avg_heart_rate: lap.avgHeartRate,
          max_heart_rate: lap.maxHeartRate,
          avg_speed: lap.avgSpeed,
          calories: lap.calories
        }));

        const { error: lapsError } = await supabase
          .from('wearable_laps')
          .upsert(lapsToInsert, {
            onConflict: 'wearable_data_id,lap_index'
          });

        if (lapsError) {
          console.error('Laps insert error:', lapsError);
        } else {
          console.log(`Inserted ${lapsToInsert.length} laps for session`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionsImported: parsedData.sessions.length,
        recordsImported: parsedData.records.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error processing FIT file:', error);
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

async function parseFitFile(data: Uint8Array) {
  const sessions: any[] = [];
  const records: any[] = [];
  const gpsPoints: any[] = [];
  
  try {
    console.log('Parsing FIT file with Official Garmin SDK...');
    
    // Dynamically import Garmin FIT SDK
    const { Decoder, Stream } = await import('npm:@garmin/fitsdk');
    
    // Use Official Garmin FIT SDK
    const stream = Stream.fromByteArray(data);
    const decoder = new Decoder(stream);
    const { messages, errors } = decoder.read();
    
    if (errors.length > 0) {
      console.warn('FIT parsing warnings:', errors);
    }
    
    console.log(`Parsed ${messages.length} total messages from FIT file`);
    
    // Process session messages
    const sessionMsgs = messages.sessionMesgs || [];
    for (const session of sessionMsgs) {
      const sportMap: Record<string, string> = {
        'running': 'running',
        'cycling': 'cycling',
        'swimming': 'swimming',
        'walking': 'walking',
        'hiking': 'hiking',
        'training': 'training',
        'transition': 'transition',
        'fitness_equipment': 'fitness',
      };
      
      sessions.push({
        timestamp: session.startTime || session.timestamp || new Date().toISOString(),
        activityType: sportMap[session.sport] || session.sport || 'unknown',
        totalDistance: session.totalDistance || 0,
        totalCalories: session.totalCalories || 0,
        avgHeartRate: session.avgHeartRate || 0,
        maxHeartRate: session.maxHeartRate || 0,
        avgCadence: session.avgCadence || session.avgRunningCadence || 0,
        avgPower: session.avgPower || 0,
        maxSpeed: session.maxSpeed || session.enhancedMaxSpeed || 0,
        totalAscent: session.totalAscent || 0,
        duration: session.totalElapsedTime || 0,
        activeMinutes: Math.round((session.totalTimerTime || 0) / 60),
        avgTemperature: session.avgTemperature,
        trainingEffect: session.totalTrainingEffect,
        recoveryTime: session.timeToRecovery,
      });
    }
    
    // Process record messages (data points)
    const recordMsgs = messages.recordMesgs || [];
    for (const record of recordMsgs) {
      const recordData: any = {
        timestamp: record.timestamp,
        heartRate: record.heartRate,
        cadence: record.cadence || record.runningCadence,
        speed: record.speed || record.enhancedSpeed,
        power: record.power,
        altitude: record.altitude || record.enhancedAltitude,
        distance: record.distance,
        temperature: record.temperature,
      };
      records.push(recordData);
      
      // Collect GPS data if available
      if (record.positionLat !== undefined && record.positionLong !== undefined) {
        gpsPoints.push({
          lat: record.positionLat * (180 / Math.pow(2, 31)), // Convert semicircles to degrees
          lng: record.positionLong * (180 / Math.pow(2, 31)),
          altitude: record.altitude || record.enhancedAltitude,
          timestamp: record.timestamp
        });
      }
    }
    
    // Process lap messages for additional insights
    const lapMsgs = messages.lapMesgs || [];
    const laps = lapMsgs.map((lap: any) => ({
      startTime: lap.startTime,
      totalTime: lap.totalTimerTime,
      totalDistance: lap.totalDistance,
      avgHeartRate: lap.avgHeartRate,
      maxHeartRate: lap.maxHeartRate,
      avgSpeed: lap.avgSpeed || lap.enhancedAvgSpeed,
      calories: lap.totalCalories,
    }));
    
    // If no sessions found but we have records, create a synthetic session
    if (sessions.length === 0 && records.length > 0) {
      const heartRates = records.filter(r => r.heartRate).map(r => r.heartRate);
      const avgHeartRate = heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : 0;
      const maxHeartRate = heartRates.length > 0 ? Math.max(...heartRates) : 0;
      
      sessions.push({
        timestamp: records[0]?.timestamp || new Date().toISOString(),
        activityType: 'unknown',
        totalDistance: records[records.length - 1]?.distance || 0,
        totalCalories: 0,
        avgHeartRate: Math.round(avgHeartRate),
        maxHeartRate,
        avgCadence: 0,
        avgPower: 0,
        maxSpeed: 0,
        totalAscent: 0,
        duration: 0,
        activeMinutes: Math.round(records.length / 60)
      });
    }
    
    // Calculate heart rate zones
    const heartRateZones = calculateHeartRateZones(records);
    
    console.log(`Extracted ${sessions.length} sessions, ${records.length} records, ${gpsPoints.length} GPS points, ${laps.length} laps`);
    
    return {
      sessions,
      records,
      gpsPoints,
      heartRateZones,
      laps
    };
    
  } catch (error) {
    console.error('Error parsing FIT file:', error);
    throw new Error(`FIT file parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function calculateHeartRateZones(records: any[]) {
  const zones = {
    zone1: 0, // < 114 bpm (recovery)
    zone2: 0, // 114-133 (endurance)
    zone3: 0, // 133-152 (tempo)
    zone4: 0, // 152-171 (threshold)
    zone5: 0  // > 171 (max)
  };

  records.forEach(record => {
    const hr = record.heartRate;
    if (!hr) return;

    if (hr < 114) zones.zone1++;
    else if (hr < 133) zones.zone2++;
    else if (hr < 152) zones.zone3++;
    else if (hr < 171) zones.zone4++;
    else zones.zone5++;
  });

  // Convert to minutes (assuming 1 record per second)
  return {
    zone1: Math.round(zones.zone1 / 60),
    zone2: Math.round(zones.zone2 / 60),
    zone3: Math.round(zones.zone3 / 60),
    zone4: Math.round(zones.zone4 / 60),
    zone5: Math.round(zones.zone5 / 60)
  };
}
