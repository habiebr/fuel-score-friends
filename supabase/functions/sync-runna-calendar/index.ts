import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, x-requested-with, expires, pragma",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ICSEvent {
  date: string;
  summary: string;
  description: string;
  duration: string;
  startTime?: string;
  endTime?: string;
}

function parseICS(icsText: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent: Partial<ICSEvent> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.date && currentEvent.summary) {
        events.push(currentEvent as ICSEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('DTSTART')) {
        // Handle both DTSTART:20251028T190000Z and DTSTART;VALUE=DATE:20251028
        const match = line.match(/DTSTART[^:]*:(\d{8})/);
        if (match) {
          const dateStr = match[1];
          currentEvent.date = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          
          // Extract time if present
          const timeMatch = line.match(/T(\d{6})/);
          if (timeMatch) {
            currentEvent.startTime = `${timeMatch[1].substring(0, 2)}:${timeMatch[1].substring(2, 4)}`;
          }
        }
      } else if (line.startsWith('DTEND')) {
        const timeMatch = line.match(/T(\d{6})/);
        if (timeMatch) {
          currentEvent.endTime = `${timeMatch[1].substring(0, 2)}:${timeMatch[1].substring(2, 4)}`;
        }
      } else if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8).trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12).trim();
      } else if (line.startsWith('X-WORKOUT-ESTIMATED-DURATION:')) {
        currentEvent.duration = line.substring(29).trim();
      }
    }
  }
  
  return events;
}

function parseDuration(duration: string | undefined): number {
  if (!duration) return 60; // Default 60 minutes
  
  // Parse PT1H format (ISO 8601)
  const hourMatch = duration.match(/(\d+)H/);
  const minuteMatch = duration.match(/(\d+)M/);
  
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
  
  return (hours * 60) + minutes || 60;
}

function parseDistance(description: string | undefined): number | null {
  if (!description) return null;
  
  // Look for distance in description (e.g., "5km", "10 km", "5k")
  const kmMatch = description.match(/(\d+(?:\.\d+)?)\s*k(?:m)?/i);
  if (kmMatch) {
    return parseFloat(kmMatch[1]);
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Invalid user token");
    }

    const { calendar_url } = await req.json();
    
    if (!calendar_url || !calendar_url.includes('.ics')) {
      throw new Error("Invalid calendar URL");
    }

    console.log(`Fetching Runna calendar for user ${user.id}: ${calendar_url}`);

    // Fetch ICS file
    const icsResponse = await fetch(calendar_url, {
      headers: {
        'User-Agent': 'NutriSync/1.0'
      }
    });

    if (!icsResponse.ok) {
      throw new Error(`Failed to fetch calendar: ${icsResponse.status} ${icsResponse.statusText}`);
    }

    const icsText = await icsResponse.text();
    
    if (!icsText.includes('BEGIN:VCALENDAR')) {
      throw new Error("Invalid ICS file format");
    }

    // Parse ICS
    const events = parseICS(icsText);
    console.log(`Parsed ${events.length} events from calendar`);

    // Filter for future events only
    const today = new Date().toISOString().split('T')[0];
    const futureEvents = events.filter(e => e.date >= today);
    console.log(`${futureEvents.length} future events found`);

    if (futureEvents.length === 0) {
      console.log('⚠️ No future events in calendar - pattern will take over');
    }

    // Delete old Runna activities (for refresh)
    const { error: deleteError } = await supabase
      .from('training_activities')
      .delete()
      .eq('user_id', user.id)
      .eq('is_from_runna', true)
      .eq('is_actual', false)
      .gte('date', today);

    if (deleteError) {
      console.error('Error deleting old Runna activities:', deleteError);
      throw deleteError;
    }

    // Insert new Runna activities
    if (futureEvents.length > 0) {
      const activities = futureEvents.map(event => ({
        user_id: user.id,
        date: event.date,
        activity_type: event.summary,
        duration_minutes: parseDuration(event.duration),
        distance_km: parseDistance(event.description),
        notes: event.description || null,
        start_time: event.startTime || null,
        intensity: event.summary.toLowerCase().includes('tempo') || event.summary.toLowerCase().includes('interval') ? 'high' : 
                   event.summary.toLowerCase().includes('easy') || event.summary.toLowerCase().includes('recovery') ? 'low' : 'moderate',
        is_from_runna: true,
        is_actual: false
      }));

      const { error: insertError } = await supabase
        .from('training_activities')
        .insert(activities);

      if (insertError) {
        console.error('Error inserting Runna activities:', insertError);
        throw insertError;
      }
    }

    // Update profile with sync timestamp
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        runna_calendar_url: calendar_url,
        runna_last_synced_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        activities_synced: futureEvents.length,
        message: futureEvents.length === 0 
          ? 'Calendar synced successfully. No future activities found - pattern generator will create your plan.'
          : `Successfully synced ${futureEvents.length} activities from Runna calendar`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error('===== Sync Error Details =====');
    console.error('Error type:', typeof error);
    console.error('Error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'N/A');
    
    let message = "Unknown error";
    let details = null;
    
    if (error instanceof Error) {
      message = error.message;
      details = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      message = JSON.stringify(error);
    }
    
    console.error('Returning error message:', message);
    
    return new Response(
      JSON.stringify({ 
        error: message,
        details: details,
        type: typeof error
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});

