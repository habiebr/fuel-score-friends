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
          gps_data: parsedData.gpsPoints.slice(0, 500), // Limit GPS points
          detailed_metrics: {
            avgCadence: session.avgCadence,
            avgPower: session.avgPower,
            maxSpeed: session.maxSpeed,
            totalAscent: session.totalAscent,
            duration: session.duration
          }
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
    
    console.log('Valid FIT file detected, parsing data...');
    
    // Parse FIT messages
    const messages = await parseFitMessages(data, headerSize);
    
    console.log(`Parsed ${messages.length} total messages`);
    
    // Extract session data
    for (const msg of messages) {
      if (msg.type === 'session') {
        sessions.push({
          timestamp: msg.start_time || msg.timestamp || new Date().toISOString(),
          activityType: msg.sport || 'unknown',
          totalDistance: msg.total_distance || 0,
          totalCalories: msg.total_calories || 0,
          avgHeartRate: msg.avg_heart_rate || 0,
          maxHeartRate: msg.max_heart_rate || 0,
          avgCadence: msg.avg_cadence || 0,
          avgPower: msg.avg_power || 0,
          maxSpeed: msg.max_speed || 0,
          totalAscent: msg.total_ascent || 0,
          duration: msg.total_elapsed_time || 0,
          activeMinutes: Math.round((msg.total_timer_time || 0) / 60)
        });
      }
      
      // Extract record data points
      if (msg.type === 'record') {
        const record: any = {
          timestamp: msg.timestamp,
          heartRate: msg.heart_rate,
          cadence: msg.cadence,
          speed: msg.speed,
          power: msg.power,
          altitude: msg.altitude,
          distance: msg.distance
        };
        records.push(record);
        
        // Collect GPS data if available
        if (msg.position_lat && msg.position_long) {
          gpsPoints.push({
            lat: msg.position_lat * (180 / Math.pow(2, 31)), // Convert semicircles to degrees
            lng: msg.position_long * (180 / Math.pow(2, 31)),
            altitude: msg.altitude,
            timestamp: msg.timestamp
          });
        }
      }
    }
    
    // If no sessions found but we have records, create a synthetic session
    if (sessions.length === 0 && records.length > 0) {
      const totalCalories = records.reduce((sum, r) => sum + (r.calories || 0), 0);
      const heartRates = records.filter(r => r.heartRate).map(r => r.heartRate);
      const avgHeartRate = heartRates.length > 0 ? heartRates.reduce((a, b) => a + b, 0) / heartRates.length : 0;
      const maxHeartRate = heartRates.length > 0 ? Math.max(...heartRates) : 0;
      
      sessions.push({
        timestamp: records[0]?.timestamp || new Date().toISOString(),
        activityType: 'unknown',
        totalDistance: records[records.length - 1]?.distance || 0,
        totalCalories,
        avgHeartRate,
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
    
    return {
      sessions,
      records,
      gpsPoints,
      heartRateZones
    };
    
  } catch (error) {
    console.error('Error parsing FIT file:', error);
    throw new Error(`FIT file parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parseFitMessages(data: Uint8Array, headerSize: number): Promise<any[]> {
  const messages: any[] = [];
  let offset = headerSize;
  const definitions = new Map();
  
  // Read data size from header
  const dataSize = data[4] | (data[5] << 8) | (data[6] << 16) | (data[7] << 24);
  const endOffset = Math.min(headerSize + dataSize, data.length - 2);
  
  while (offset < endOffset) {
    if (offset >= data.length) break;
    
    const recordHeader = data[offset];
    offset++;
    
    // Check for compressed timestamp header
    if ((recordHeader & 0x80) === 0x80) {
      const localMessageType = (recordHeader >> 5) & 0x03;
      
      const def = definitions.get(localMessageType);
      if (def && offset + def.size <= data.length) {
        const fields = readFields(data, offset, def.fields);
        offset += def.size;
        messages.push({ type: def.globalType, ...fields });
      }
      continue;
    }
    
    const isDefinitionMessage = (recordHeader & 0x40) === 0x40;
    const localMessageType = recordHeader & 0x0F;
    
    if (isDefinitionMessage) {
      // Parse definition message
      if (offset + 5 >= data.length) break;
      
      offset++; // Skip reserved byte
      offset++; // Skip architecture byte
      
      const globalMessageNumber = data[offset] | (data[offset + 1] << 8);
      offset += 2;
      
      const numFields = data[offset];
      offset++;
      
      const fields = [];
      for (let i = 0; i < numFields && offset + 3 <= data.length; i++) {
        const fieldDef = data[offset];
        const fieldSize = data[offset + 1];
        const fieldType = data[offset + 2];
        offset += 3;
        
        fields.push({ def: fieldDef, size: fieldSize, type: fieldType });
      }
      
      const totalSize = fields.reduce((sum, f) => sum + f.size, 0);
      definitions.set(localMessageType, {
        globalType: getMessageType(globalMessageNumber),
        fields,
        size: totalSize
      });
    } else {
      // Parse data message
      const def = definitions.get(localMessageType);
      if (def && offset + def.size <= data.length) {
        const fields = readFields(data, offset, def.fields);
        offset += def.size;
        messages.push({ type: def.globalType, ...fields });
      } else {
        offset += 10; // Skip if we can't parse
      }
    }
  }
  
  return messages;
}

function readFields(data: Uint8Array, offset: number, fieldDefs: any[]): any {
  const fields: any = {};
  let currentOffset = offset;
  
  for (const fieldDef of fieldDefs) {
    if (currentOffset + fieldDef.size > data.length) break;
    
    let value;
    switch (fieldDef.size) {
      case 1:
        value = data[currentOffset];
        break;
      case 2:
        value = data[currentOffset] | (data[currentOffset + 1] << 8);
        break;
      case 4:
        value = data[currentOffset] | (data[currentOffset + 1] << 8) | 
                (data[currentOffset + 2] << 16) | (data[currentOffset + 3] << 24);
        break;
      default:
        currentOffset += fieldDef.size;
        continue;
    }
    
    currentOffset += fieldDef.size;
    
    // Map field definitions to field names
    const fieldName = getFieldName(fieldDef.def);
    if (fieldName && value !== 0xFF && value !== 0xFFFF && value !== 0xFFFFFFFF) {
      fields[fieldName] = value;
    }
  }
  
  return fields;
}

function getMessageType(globalMessageNumber: number): string {
  const types: Record<number, string> = {
    0: 'file_id',
    18: 'session',
    19: 'lap',
    20: 'record',
    21: 'event',
    23: 'device_info',
    34: 'activity',
  };
  return types[globalMessageNumber] || 'unknown';
}

function getFieldName(fieldDef: number): string | null {
  const names: Record<number, string> = {
    253: 'timestamp',
    0: 'start_time',
    1: 'position_lat',
    2: 'position_long',
    3: 'altitude',
    4: 'heart_rate',
    5: 'cadence',
    6: 'distance',
    7: 'speed',
    8: 'power',
    9: 'total_elapsed_time',
    10: 'total_timer_time',
    11: 'total_distance',
    13: 'total_calories',
    14: 'total_ascent',
    15: 'avg_heart_rate',
    16: 'max_heart_rate',
    17: 'avg_cadence',
    18: 'avg_power',
    19: 'max_speed',
    20: 'sport',
    21: 'sub_sport',
  };
  return names[fieldDef] || null;
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
