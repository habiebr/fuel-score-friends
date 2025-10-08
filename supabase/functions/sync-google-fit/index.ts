// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const googleToken =
      req.headers.get("x-google-token") || (await req.json().catch(() => ({})))?.providerToken;
    if (!googleToken) {
      return new Response(JSON.stringify({ error: "Google provider token missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const aggregate = async (dataTypeName: string) => {
      const res = await fetch(
        "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            aggregateBy: [{ dataTypeName }],
            bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
            startTimeMillis: startOfDay.getTime(),
            endTimeMillis: endOfDay.getTime(),
          }),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Google Fit error ${res.status}: ${txt}`);
      }
      return await res.json();
    };

    const [stepsData, caloriesData, activeMinutesData, heartRateData] =
      await Promise.all([
        aggregate("com.google.step_count.delta"),
        aggregate("com.google.calories.expended"),
        aggregate("com.google.active_minutes"),
        aggregate("com.google.heart_rate.bpm").catch(() => null),
      ]);

    const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    const caloriesBurned =
      caloriesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0;
    const activeMinutes =
      activeMinutesData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
    const heartRateAvg =
      heartRateData?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal;

    const sessionsRes = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`,
      { headers: { Authorization: `Bearer ${googleToken}` } }
    );
    let sessions: any[] = [];
    if (sessionsRes.ok) {
      const sessionsData = await sessionsRes.json();
      sessions = sessionsData.session || [];
    }

    // Filter sessions to only include running/sport activities (exclude walking)
    const exerciseActivities = ['running', 'jogging', 'cycling', 'biking', 'swimming', 'hiking', 'elliptical', 'rowing', 'soccer', 'basketball', 'tennis', 'volleyball', 'golf', 'skiing', 'snowboarding', 'skating', 'dancing', 'aerobics', 'strength_training', 'weight_lifting', 'crossfit', 'yoga', 'pilates', 'martial_arts', 'boxing', 'kickboxing', 'climbing', 'rock_climbing', 'surfing', 'kayaking', 'canoeing', 'rowing', 'triathlon', 'duathlon', 'athletics', 'track_and_field'];
    
    const filteredSessions = sessions.filter((session: any) => {
      const activityType = (session.activityType || session.activityTypeId || session.activity || '').toLowerCase();
      return exerciseActivities.some(activity => activityType.includes(activity));
    });

    // Calculate distance only from exercise activities
    let exerciseDistanceMeters = 0;
    if (filteredSessions.length > 0) {
      // Get detailed data for each exercise session to calculate distance
      for (const session of filteredSessions) {
        try {
          const sessionStartTime = new Date(Number(session.startTimeMillis));
          const sessionEndTime = new Date(Number(session.endTimeMillis));
          
          const sessionDistanceRes = await fetch(
            "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${googleToken}`,
                "Content-Type": "application/json",
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
          }
        } catch (error) {
          console.warn('Failed to get distance for session:', error);
        }
      }
    }

    // Upsert aggregate row
    await supabaseClient
      .from("google_fit_data")
      .upsert(
        {
          user_id: user.id,
          date: today.toISOString().split("T")[0],
          steps,
          calories_burned: caloriesBurned,
          active_minutes: activeMinutes,
          distance_meters: exerciseDistanceMeters, // Use exercise-only distance
          heart_rate_avg: heartRateAvg,
          sessions: filteredSessions, // Use filtered sessions
          last_synced_at: new Date().toISOString(),
          sync_source: "google_fit",
        },
        { onConflict: "user_id,date" }
      );

    // Upsert normalized sessions
    if (Array.isArray(filteredSessions) && filteredSessions.length > 0) {
      const mapped = filteredSessions.map((s: any) => ({
        user_id: user.id,
        session_id: String(s.id || `${s.startTimeMillis}-${s.endTimeMillis}`),
        start_time: s.startTimeMillis
          ? new Date(Number(s.startTimeMillis)).toISOString()
          : new Date().toISOString(),
        end_time: s.endTimeMillis
          ? new Date(Number(s.endTimeMillis)).toISOString()
          : new Date().toISOString(),
        activity_type: s.activityType || s.activityTypeId || s.activity || null,
        name: s.name || null,
        description: s.description || null,
        source: "google_fit",
        raw: s,
      }));

      const batchSize = 50;
      for (let i = 0; i < mapped.length; i += batchSize) {
        const chunk = mapped.slice(i, i + batchSize);
        await supabaseClient.from("google_fit_sessions").upsert(chunk, {
          onConflict: "user_id,session_id",
        });
      }
    }

    return new Response(
      JSON.stringify({
        steps,
        caloriesBurned,
        activeMinutes,
        distanceMeters,
        heartRateAvg,
        sessionsCount: sessions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


