import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface FitRecord {
  timestamp: string;
  heartRate?: number;
  calories?: number;
  steps?: number;
  distance?: number;
  speed?: number;
  cadence?: number;
  power?: number;
  altitude?: number;
  duration?: number;
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

    const { fitData } = await req.json();
    
    // Decode base64 .fit file data
    const binaryData = Uint8Array.from(atob(fitData), c => c.charCodeAt(0));
    
    // Parse .fit file (simplified parser - in production use a proper FIT SDK)
    const records = await parseFitFile(binaryData);
    
    // Aggregate daily data
    const dailyData = aggregateDailyData(records);
    
    // Insert/update wearable_data
    const today = new Date().toISOString().split('T')[0];
    const { error: upsertError } = await supabase
      .from('wearable_data')
      .upsert({
        user_id: user.id,
        date: today,
        steps: dailyData.steps || 0,
        calories_burned: dailyData.calories || 0,
        active_minutes: dailyData.activeMinutes || 0,
        heart_rate_avg: dailyData.heartRateAvg || 0,
      }, {
        onConflict: 'user_id,date'
      });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        recordsImported: records.length,
        date: today 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error processing .fit file:', error);
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

async function parseFitFile(data: Uint8Array): Promise<FitRecord[]> {
  const records: FitRecord[] = [];
  
  try {
    // Validate FIT file header
    if (data.length < 14) {
      throw new Error('File too small to be a valid FIT file');
    }
    
    const headerSize = data[0];
    if (headerSize !== 14 && headerSize !== 12) {
      throw new Error('Invalid FIT file header size');
    }
    
    // Check FIT signature (.FIT)
    const signature = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (signature !== '.FIT') {
      throw new Error('Invalid FIT file signature');
    }
    
    console.log('Valid FIT file detected, extracting metadata...');
    
    // Extract basic file info
    const dataSize = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
    console.log(`FIT file data size: ${dataSize} bytes`);
    
    // Parse messages - simplified approach for key metrics
    let offset = headerSize;
    let totalCalories = 0;
    let totalDistance = 0;
    let maxHeartRate = 0;
    let avgHeartRate = 0;
    let maxSpeed = 0;
    let totalTime = 0;
    let recordCount = 0;
    
    // Scan through the file looking for session summary messages
    // This is a simplified parser that extracts key metrics
    while (offset < data.length - 2) {
      const byte = data[offset];
      
      // Check if this is a definition message or data message
      if ((byte & 0x40) === 0x40) {
        // Compressed timestamp header
        offset++;
        continue;
      }
      
      const isDefinitionMessage = (byte & 0x40) === 0x40;
      const messageType = byte & 0x0F;
      
      offset++;
      
      // Skip message content (simplified - real parser would decode fields)
      if (offset < data.length - 20) {
        // Try to extract some basic values from common positions
        // This is a heuristic approach for demo purposes
        const value16 = data[offset] | (data[offset + 1] << 8);
        const value32 = data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
        
        // Common ranges for different metrics
        if (value16 > 0 && value16 < 250) {
          // Likely heart rate
          if (value16 > maxHeartRate) maxHeartRate = value16;
          avgHeartRate = (avgHeartRate + value16) / 2;
        }
        
        if (value32 > 100 && value32 < 10000) {
          // Likely calories or distance (cm)
          totalCalories = Math.max(totalCalories, value32);
          totalDistance = Math.max(totalDistance, value32 / 100000); // Convert to km
        }
        
        recordCount++;
      }
      
      offset += 10; // Skip ahead
    }
    
    // Generate aggregated record
    const timestamp = new Date().toISOString();
    records.push({
      timestamp,
      heartRate: Math.round(avgHeartRate) || undefined,
      calories: totalCalories || undefined,
      distance: Math.round(totalDistance * 100) / 100 || undefined,
      speed: maxSpeed || undefined,
    });
    
    console.log(`Extracted ${recordCount} data points from FIT file`);
    console.log(`Summary - HR: ${Math.round(avgHeartRate)}, Calories: ${totalCalories}, Distance: ${totalDistance}km`);
    
    return records;
    
  } catch (error) {
    console.error('Error parsing FIT file:', error);
    throw new Error(`FIT file parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function aggregateDailyData(records: FitRecord[]) {
  let totalCalories = 0;
  let totalSteps = 0;
  let totalDistance = 0;
  let heartRateSum = 0;
  let heartRateCount = 0;
  let activeMinutes = 0;
  let maxSpeed = 0;
  let avgPower = 0;
  let powerCount = 0;

  for (const record of records) {
    if (record.calories) totalCalories += record.calories;
    if (record.steps) totalSteps += record.steps;
    if (record.distance) totalDistance += record.distance;
    
    if (record.heartRate) {
      heartRateSum += record.heartRate;
      heartRateCount++;
      
      // Estimate active minutes based on heart rate
      if (record.heartRate > 100) {
        activeMinutes += 1;
      }
    }
    
    if (record.speed && record.speed > maxSpeed) {
      maxSpeed = record.speed;
    }
    
    if (record.power) {
      avgPower += record.power;
      powerCount++;
    }
  }

  return {
    calories: Math.round(totalCalories),
    steps: totalSteps,
    distance: Math.round(totalDistance * 100) / 100,
    heartRateAvg: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : 0,
    activeMinutes,
    maxSpeed: Math.round(maxSpeed * 100) / 100,
    avgPower: powerCount > 0 ? Math.round(avgPower / powerCount) : 0,
  };
}
