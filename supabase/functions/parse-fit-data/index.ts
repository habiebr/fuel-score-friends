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
    
    console.log('Valid FIT file detected, parsing data...');
    
    // Parse FIT file using proper message definitions
    const messages = await parseFitMessages(data, headerSize);
    
    // Extract records from parsed messages
    for (const msg of messages) {
      if (msg.type === 'record' || msg.type === 'session') {
        const record: FitRecord = {
          timestamp: msg.timestamp || new Date().toISOString(),
          heartRate: msg.heart_rate,
          calories: msg.total_calories || msg.calories,
          steps: msg.total_steps || msg.steps,
          distance: msg.total_distance ? msg.total_distance / 100 : undefined, // cm to m
          speed: msg.speed ? msg.speed / 1000 : undefined, // mm/s to m/s
          cadence: msg.cadence,
          power: msg.power,
          altitude: msg.altitude,
          duration: msg.total_elapsed_time,
        };
        records.push(record);
      }
    }
    
    console.log(`Parsed ${records.length} records from FIT file`);
    return records;
    
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
      const timeOffset = recordHeader & 0x1F;
      
      const def = definitions.get(localMessageType);
      if (def) {
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
    
    // Map field definitions to field names (simplified mapping)
    const fieldName = getFieldName(fieldDef.def);
    if (fieldName && value !== 0xFFFF && value !== 0xFFFFFFFF) {
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
    2: 'altitude',
    3: 'heart_rate',
    5: 'total_distance',
    6: 'speed',
    7: 'total_calories',
    8: 'cadence',
    9: 'total_elapsed_time',
    11: 'total_steps',
    13: 'avg_heart_rate',
    14: 'max_heart_rate',
    15: 'power',
  };
  return names[fieldDef] || null;
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
